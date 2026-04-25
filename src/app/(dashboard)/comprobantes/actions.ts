'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { notificarPagoConfirmado, notificarPagoRechazado } from '@/lib/resend/emails'
import { wsPagoConfirmado, wsPagoRechazado } from '@/lib/whatsapp/notifications'
import { guardServerMutation } from '@/lib/security/request'
import { restaurarInventarioPedido } from '@/lib/orders/restore-stock'

type PedidoConItems = {
  id: string
  numero: string
  comprador_nombre: string
  comprador_email: string | null
  comprador_telefono: string | null
  monto_total: number
  metodo_envio: 'pickup' | 'domicilio' | null
  direccion: string | null
  tienda_id: string
  estado: string | null
  comprobante_estado: string | null
  drop_id: string | null
  pedido_items?: unknown
}

type ComprobanteContexto = {
  id: string
  pedido_id: string
  tienda_id: string
  estado: 'pendiente' | 'verificado' | 'rechazado'
}

type TiendaContexto = {
  id: string
  nombre: string
  username: string
  user_id: string
  contact_email: string | null
  whatsapp: string | null
}

type ContextoPago = {
  pedido: PedidoConItems
  comprobante: ComprobanteContexto
  tienda: TiendaContexto
  tiendaEmail: string
  prendaNombre: string
}

function getPrendaNombre(pedidoItems: unknown) {
  const items = Array.isArray(pedidoItems) ? pedidoItems : []
  const first = items[0] as { prendas?: { nombre?: string | null } | null } | undefined
  return first?.prendas?.nombre ?? 'Prenda'
}

async function getContextoAutorizado(comprobanteId: string, pedidoId: string) {
  const guardError = await guardServerMutation('dashboard:comprobantes', 80, 10 * 60)
  if (guardError) return { error: guardError }

  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return { error: 'Iniciá sesión para procesar comprobantes.' }
  }

  const { data: comprobanteData, error: comprobanteError } = await supabase
    .from('comprobantes')
    .select('id, pedido_id, tienda_id, estado')
    .eq('id', comprobanteId)
    .eq('pedido_id', pedidoId)
    .maybeSingle()

  if (comprobanteError) return { error: 'No pudimos leer el comprobante.' }
  const comprobante = comprobanteData as ComprobanteContexto | null
  if (!comprobante) return { error: 'Comprobante no encontrado.' }

  const { data: pedidoData, error: pedidoError } = await supabase
    .from('pedidos')
    .select(`
      id, numero, comprador_nombre, comprador_email, comprador_telefono, monto_total,
      metodo_envio, direccion, tienda_id, estado, comprobante_estado, drop_id,
      pedido_items (
        prendas ( nombre )
      )
    `)
    .eq('id', pedidoId)
    .maybeSingle()

  if (pedidoError) return { error: 'No pudimos leer el pedido.' }
  const pedido = pedidoData as PedidoConItems | null
  if (!pedido || pedido.tienda_id !== comprobante.tienda_id) {
    return { error: 'El comprobante no pertenece a este pedido.' }
  }

  const { data: tienda, error: tiendaError } = await supabase
    .from('tiendas')
    .select('id, nombre, username, user_id, contact_email, whatsapp')
    .eq('id', pedido.tienda_id)
    .maybeSingle()

  if (tiendaError) return { error: 'No pudimos validar la tienda.' }
  if (!tienda || tienda.user_id !== user.id) {
    return { error: 'No tenés permiso para procesar este comprobante.' }
  }

  const tiendaEmail = tienda.contact_email?.trim() ?? ''

  return {
    db: supabase,
    ctx: {
      pedido,
      comprobante,
      tienda,
      tiendaEmail,
      prendaNombre: getPrendaNombre(pedido.pedido_items),
    } satisfies ContextoPago,
  }
}

function revalidarContexto(ctx: ContextoPago) {
  revalidatePath('/comprobantes')
  revalidatePath('/pedidos')
  revalidatePath(`/pedido/${ctx.pedido.numero}`)
  revalidatePath(`/${ctx.tienda.username}`)
  if (ctx.pedido.drop_id) {
    revalidatePath(`/${ctx.tienda.username}/drop/${ctx.pedido.drop_id}`)
  }
}

export async function confirmarPago(comprobanteId: string, pedidoId: string) {
  const result = await getContextoAutorizado(comprobanteId, pedidoId)
  if ('error' in result) return { error: result.error }

  const { db, ctx } = result
  const now = new Date().toISOString()

  if (ctx.comprobante.estado === 'verificado' || ctx.pedido.estado === 'pagado') {
    revalidarContexto(ctx)
    return { ok: true, alreadyProcessed: true }
  }

  if (ctx.comprobante.estado !== 'pendiente' || ctx.pedido.estado === 'cancelado') {
    return { error: 'Este comprobante ya fue procesado.' }
  }

  const { data: comprobanteActualizado, error: comprobanteError } = await db.from('comprobantes').update({
    estado: 'verificado',
    verificado_at: now,
  })
    .eq('id', comprobanteId)
    .eq('pedido_id', pedidoId)
    .eq('tienda_id', ctx.tienda.id)
    .eq('estado', 'pendiente')
    .select('id')
    .maybeSingle()

  if (comprobanteError) return { error: 'No pudimos confirmar el comprobante.' }
  if (!comprobanteActualizado) return { error: 'Este comprobante ya fue procesado.' }

  const { error: pedidoUpdateError } = await db.from('pedidos').update({
    estado: 'pagado',
    pagado_at: now,
    comprobante_estado: 'verificado',
  })
    .eq('id', pedidoId)
    .eq('tienda_id', ctx.tienda.id)

  if (pedidoUpdateError) return { error: 'Confirmamos el comprobante, pero no pudimos actualizar el pedido.' }

  const [email] = await Promise.all([
    notificarPagoConfirmado({
      compradorEmail: ctx.pedido.comprador_email,
      compradorNombre: ctx.pedido.comprador_nombre,
      pedidoId: ctx.pedido.id,
      numeroPedido: ctx.pedido.numero,
      prendaNombre: ctx.prendaNombre,
      montoTotal: ctx.pedido.monto_total,
      tiendaNombre: ctx.tienda.nombre,
      tiendaEmail: ctx.tiendaEmail,
      metodoEnvio: ctx.pedido.metodo_envio === 'domicilio' ? 'Envío a domicilio' : 'Pickup / Retiro en tienda',
      direccion: ctx.pedido.direccion,
    }),
    wsPagoConfirmado({
      compradorWhatsApp: ctx.pedido.comprador_telefono,
      compradorNombre: ctx.pedido.comprador_nombre,
      numeroPedido: ctx.pedido.numero,
      prendaNombre: ctx.prendaNombre,
      montoTotal: ctx.pedido.monto_total,
      tiendaNombre: ctx.tienda.nombre,
    }).catch(() => {}),
  ])

  revalidarContexto(ctx)
  return { ok: true, email }
}

export async function rechazarPago(comprobanteId: string, pedidoId: string, notas?: string) {
  const result = await getContextoAutorizado(comprobanteId, pedidoId)
  if ('error' in result) return { error: result.error }

  const { db, ctx } = result
  const now = new Date().toISOString()

  if (ctx.comprobante.estado === 'rechazado' || ctx.pedido.estado === 'cancelado') {
    revalidarContexto(ctx)
    return { ok: true, alreadyProcessed: true }
  }

  if (ctx.comprobante.estado !== 'pendiente' || ctx.pedido.estado === 'pagado') {
    return { error: 'Este comprobante ya fue procesado.' }
  }

  const { data: comprobanteActualizado, error: comprobanteError } = await db.from('comprobantes').update({
    estado: 'rechazado',
    notas_rechazo: notas ?? null,
    verificado_at: now,
  })
    .eq('id', comprobanteId)
    .eq('pedido_id', pedidoId)
    .eq('tienda_id', ctx.tienda.id)
    .eq('estado', 'pendiente')
    .select('id')
    .maybeSingle()

  if (comprobanteError) return { error: 'No pudimos rechazar el comprobante.' }
  if (!comprobanteActualizado) return { error: 'Este comprobante ya fue procesado.' }

  const { error: pedidoUpdateError } = await db.from('pedidos').update({
    estado: 'cancelado',
    cancelado_at: now,
    comprobante_estado: 'rechazado',
  })
    .eq('id', pedidoId)
    .eq('tienda_id', ctx.tienda.id)

  if (pedidoUpdateError) return { error: 'Rechazamos el comprobante, pero no pudimos cancelar el pedido.' }

  await restaurarInventarioPedido(db, pedidoId, ctx.tienda.id)

  await Promise.all([
    notificarPagoRechazado({
      compradorEmail: ctx.pedido.comprador_email,
      compradorNombre: ctx.pedido.comprador_nombre,
      numeroPedido: ctx.pedido.numero,
      prendaNombre: ctx.prendaNombre,
      tiendaNombre: ctx.tienda.nombre,
      tiendaEmail: ctx.tiendaEmail,
      notasRechazo: notas,
    }),
    wsPagoRechazado({
      compradorWhatsApp: ctx.pedido.comprador_telefono,
      compradorNombre: ctx.pedido.comprador_nombre,
      numeroPedido: ctx.pedido.numero,
      prendaNombre: ctx.prendaNombre,
      tiendaNombre: ctx.tienda.nombre,
      notasRechazo: notas,
    }).catch(() => {}),
  ])

  revalidarContexto(ctx)
  return { ok: true }
}
