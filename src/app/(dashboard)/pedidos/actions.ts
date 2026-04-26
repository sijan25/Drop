'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { notificarCambioEstado, notificarPagoConfirmado } from '@/lib/resend/emails'
import { wsCambioEstado } from '@/lib/whatsapp/notifications'
import { guardServerMutation } from '@/lib/security/request'
import { restaurarInventarioPedido } from '@/lib/orders/restore-stock'

const TRANSITIONS: Record<string, { siguiente: string; campo: string }> = {
  pagado:   { siguiente: 'empacado',  campo: 'empacado_at' },
  empacado: { siguiente: 'en_camino', campo: 'en_camino_at' },
}

const ESTADOS_CON_EMAIL = new Set(['empacado', 'en_camino'])

async function getTiendaDelUsuario(supabase: Awaited<ReturnType<typeof createClient>>) {
  const guardError = await guardServerMutation('dashboard:pedidos', 100, 10 * 60)
  if (guardError) return { error: guardError }

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return { error: 'No autorizado.' as const }
  const { data: tienda } = await supabase.from('tiendas').select('id').eq('user_id', user.id).single()
  if (!tienda) return { error: 'Tienda no encontrada.' as const }
  return { tiendaId: tienda.id }
}

// ── Helper: contexto mínimo para email de estado ──
async function getPedidoParaEmail(pedidoId: string, tiendaId: string) {
  const supabase = await createClient()

  const { data: pedido } = await supabase
    .from('pedidos')
    .select(`
      numero, comprador_nombre, comprador_email, comprador_telefono, direccion, tienda_id,
      monto_total, metodo_envio, estado,
      pedido_items (
        prendas ( nombre )
      )
    `)
    .eq('id', pedidoId)
    .eq('tienda_id', tiendaId)
    .single()

  if (!pedido) return null

  const { data: tienda } = await supabase
    .from('tiendas')
    .select('nombre, contact_email, whatsapp')
    .eq('id', tiendaId)
    .single()

  const prendaNombre =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (pedido.pedido_items as any)?.[0]?.prendas?.nombre ?? 'Prenda'

  return {
    pedido,
    tiendaNombre: tienda?.nombre ?? 'La tienda',
    tiendaEmail: tienda?.contact_email ?? null,
    prendaNombre,
  }
}

export async function reenviarCorreoPagoConfirmado(pedidoId: string) {
  const supabase = await createClient()
  const auth = await getTiendaDelUsuario(supabase)
  if ('error' in auth) return { error: auth.error }

  const ctx = await getPedidoParaEmail(pedidoId, auth.tiendaId)
  if (!ctx) return { error: 'Pedido no encontrado.' }

  if (!['pagado', 'empacado', 'en_camino'].includes(ctx.pedido.estado ?? '')) {
    return { error: 'Este pedido todavía no tiene pago confirmado.' }
  }

  if (!ctx.pedido.comprador_email) {
    return { error: 'Este pedido no tiene correo de comprador.' }
  }

  const email = await notificarPagoConfirmado({
    compradorEmail: ctx.pedido.comprador_email,
    compradorNombre: ctx.pedido.comprador_nombre,
    pedidoId,
    numeroPedido: ctx.pedido.numero,
    prendaNombre: ctx.prendaNombre,
    montoTotal: ctx.pedido.monto_total,
    tiendaNombre: ctx.tiendaNombre,
    tiendaEmail: ctx.tiendaEmail,
    metodoEnvio: ctx.pedido.metodo_envio === 'domicilio' ? 'Envío a domicilio' : 'Pickup / Retiro en tienda',
    direccion: ctx.pedido.direccion,
  })

  if (email.status === 'failed') return { error: `No pudimos enviar el correo: ${email.error}` }
  if (email.status === 'skipped') return { error: `No se envió correo: ${email.reason}` }

  return { ok: true, emailId: email.id }
}

export async function cancelarPedido(pedidoId: string) {
  const supabase = await createClient()
  const auth = await getTiendaDelUsuario(supabase)
  if ('error' in auth) return { error: auth.error }

  const now = new Date().toISOString()

  const { error: cancelError } = await supabase.from('pedidos').update({
    estado: 'cancelado',
    cancelado_at: now,
  }).eq('id', pedidoId).eq('tienda_id', auth.tiendaId)

  if (cancelError) return { error: cancelError.message }

  await restaurarInventarioPedido(supabase, pedidoId, auth.tiendaId)

  // Delete items so drop counter triggers fire and decrement vendidas_count/recaudado_total
  const service = await createServiceClient()
  await service.from('pedido_items').delete().eq('pedido_id', pedidoId)

  revalidatePath('/pedidos')
  revalidatePath('/inventario')
  return { ok: true }
}

export async function avanzarEstado(
  pedidoId: string,
  estadoActual: string,
  tracking?: { numero?: string; url?: string },
) {
  const t = TRANSITIONS[estadoActual]
  if (!t) return { error: 'Transición no válida' }

  const supabase = await createClient()
  const auth = await getTiendaDelUsuario(supabase)
  if ('error' in auth) return { error: auth.error }

  const now = new Date().toISOString()
  const update = { estado: t.siguiente } as Record<string, unknown>
  update[t.campo] = now

  if (t.siguiente === 'en_camino') {
    update.tracking_numero = tracking?.numero?.trim() || null
    update.tracking_url = tracking?.url?.trim() || null
  }

  const { error } = await supabase
    .from('pedidos')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(update as any)
    .eq('id', pedidoId)
    .eq('tienda_id', auth.tiendaId)

  if (error) return { error: error.message }

  // ── Notificación Resend al comprador ──
  if (ESTADOS_CON_EMAIL.has(t.siguiente)) {
    const ctx = await getPedidoParaEmail(pedidoId, auth.tiendaId)
    if (ctx) {
      const trackingNumero = t.siguiente === 'en_camino' ? (tracking?.numero?.trim() || null) : null
      const trackingUrlEnvio = t.siguiente === 'en_camino' ? (tracking?.url?.trim() || null) : null
      await Promise.all([
        notificarCambioEstado({
          compradorEmail: ctx.pedido.comprador_email,
          compradorNombre: ctx.pedido.comprador_nombre,
          pedidoId,
          numeroPedido: ctx.pedido.numero,
          prendaNombre: ctx.prendaNombre,
          tiendaNombre: ctx.tiendaNombre,
          tiendaEmail: ctx.tiendaEmail,
          nuevoEstado: t.siguiente as 'empacado' | 'en_camino',
          direccion: ctx.pedido.direccion,
          metodoEnvio: ctx.pedido.metodo_envio,
          trackingNumero,
          trackingUrlEnvio,
        }),
        wsCambioEstado({
          compradorWhatsApp: ctx.pedido.comprador_telefono,
          compradorNombre: ctx.pedido.comprador_nombre,
          numeroPedido: ctx.pedido.numero,
          prendaNombre: ctx.prendaNombre,
          tiendaNombre: ctx.tiendaNombre,
          nuevoEstado: t.siguiente as 'empacado' | 'en_camino',
          trackingNumero,
          trackingUrlEnvio,
        }).catch(() => {}),
      ])
    }
  }

  revalidatePath('/pedidos')
  return { ok: true }
}
