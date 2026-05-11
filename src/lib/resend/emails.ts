import { resend, FROM_EMAIL } from './client'
import {
  emailPedidoConfirmado,
  emailNuevoPedidoVendedor,
  emailPagoConfirmado,
  emailPagoRechazado,
  emailActualizacionEstado,
  emailNuevoDropActivo,
} from './templates'
import { buildOrderTrackingUrl, getPublicAppUrl } from '@/lib/security/order-access'

const APP_URL = getPublicAppUrl()
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type EmailSendResult =
  | { status: 'sent'; id?: string }
  | { status: 'skipped'; reason: string }
  | { status: 'failed'; error: string }

function normalizarEmail(email?: string | null) {
  const value = email?.trim().toLowerCase()
  return value && EMAIL_RE.test(value) ? value : null
}

function subjectSeguro(subject: string) {
  return subject.replace(/[\r\n]+/g, ' ').trim().slice(0, 180)
}

// ────────────────────────────────────────────────────────
// ENVIAR EMAIL SEGURO (no revienta si falla)
// ────────────────────────────────────────────────────────
async function enviarEmail(opts: {
  to: string
  subject: string
  html: string
  tag?: string
  replyTo?: string | null
  idempotencyKey?: string
}): Promise<EmailSendResult> {
  if (process.env.NODE_ENV === 'production' && process.env.RESEND_TEST_REDIRECT_TO) {
    throw new Error('RESEND_TEST_REDIRECT_TO no debe estar configurado en producción.');
  }
  const testRedirect = normalizarEmail(process.env.RESEND_TEST_REDIRECT_TO)
  const to = normalizarEmail(testRedirect ?? opts.to)
  const replyTo = normalizarEmail(opts.replyTo)

  const subjectFinal = testRedirect
    ? `[TEST - ${opts.to}] ${opts.subject}`
    : opts.subject

  if (!to) {
    console.warn(`[Resend] Email omitido — destinatario inválido: "${opts.to}"`)
    return { status: 'skipped', reason: 'Destinatario inválido.' }
  }

  if (!resend) {
    console.warn('[Resend] Email omitido — RESEND_API_KEY no está configurado.')
    return { status: 'skipped', reason: 'RESEND_API_KEY no está configurado.' }
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: subjectSeguro(subjectFinal),
      html: opts.html,
      replyTo: replyTo ?? undefined,
      tags: opts.tag ? [{ name: 'tipo', value: opts.tag }] : undefined,
    }, {
      idempotencyKey: opts.idempotencyKey,
    })
    if (error) {
      console.error('[Resend] Error al enviar email:', error)
      return { status: 'failed', error: error.message }
    }

    return { status: 'sent', id: data?.id }
  } catch (err) {
    console.error('[Resend] Excepción al enviar email:', err)
    return { status: 'failed', error: err instanceof Error ? err.message : 'Error desconocido al enviar email.' }
  }
}

// ────────────────────────────────────────────────────────
// 1. PEDIDO CREADO - comprador + vendedor
// ────────────────────────────────────────────────────────
export async function notificarPedidoCreado(opts: {
  compradorEmail?: string | null
  compradorNombre: string
  compradorTelefono: string
  pedidoId: string
  numeroPedido: string
  prendaNombre: string
  prendaMarca?: string | null
  prendaTalla?: string | null
  montoTotal: number
  tiendaNombre: string
  tiendaUsername: string
  tiendaEmail?: string | null
  metodoPago: string
  metodoEnvio: string
  direccion?: string | null
  comprobanteUrl?: string | null
  pagoConfirmado?: boolean
}) {
  const comprobanteSubido = !!opts.comprobanteUrl
  const trackingUrl = buildOrderTrackingUrl({ id: opts.pedidoId, numero: opts.numeroPedido })

  // Email al comprador (solo si tiene email)
  if (opts.compradorEmail) {
    const { subject, html } = emailPedidoConfirmado({
      compradorNombre: opts.compradorNombre,
      numeroPedido: opts.numeroPedido,
      prendaNombre: opts.prendaNombre,
      prendaMarca: opts.prendaMarca,
      prendaTalla: opts.prendaTalla,
      montoTotal: opts.montoTotal,
      tiendaNombre: opts.tiendaNombre,
      tiendaUsername: opts.tiendaUsername,
      metodoPago: opts.metodoPago,
      metodoEnvio: opts.metodoEnvio,
      direccion: opts.direccion,
      comprobanteSubido,
      pagoConfirmado: opts.pagoConfirmado,
      trackingUrl,
    })
    await enviarEmail({
      to: opts.compradorEmail,
      subject,
      html,
      tag: 'pedido_creado',
      replyTo: opts.tiendaEmail,
      idempotencyKey: `pedido-creado-comprador-${opts.numeroPedido}`,
    })
  }

  // Email al vendedor
  const { subject, html } = emailNuevoPedidoVendedor({
    tiendaNombre: opts.tiendaNombre,
    numeroPedido: opts.numeroPedido,
    compradorNombre: opts.compradorNombre,
    compradorTelefono: opts.compradorTelefono,
    compradorEmail: opts.compradorEmail,
    prendaNombre: opts.prendaNombre,
    montoTotal: opts.montoTotal,
    metodoPago: opts.metodoPago,
    metodoEnvio: opts.metodoEnvio,
    direccion: opts.direccion,
    comprobanteUrl: opts.comprobanteUrl,
    trackingUrl,
    dashboardUrl: `${APP_URL}/comprobantes`,
  })
  if (opts.tiendaEmail) {
    await enviarEmail({
      to: opts.tiendaEmail,
      subject,
      html,
      tag: 'nuevo_pedido_vendedor',
      replyTo: opts.compradorEmail,
      idempotencyKey: `pedido-creado-vendedor-${opts.numeroPedido}`,
    })
  }
}

// ────────────────────────────────────────────────────────
// 2. PAGO CONFIRMADO - comprador
// ────────────────────────────────────────────────────────
export async function notificarPagoConfirmado(opts: {
  compradorEmail?: string | null
  compradorNombre: string
  pedidoId: string
  numeroPedido: string
  prendaNombre: string
  montoTotal: number
  tiendaNombre: string
  tiendaEmail?: string | null
  metodoEnvio: string
  direccion?: string | null
}) {
  if (!opts.compradorEmail) {
    return { status: 'skipped', reason: 'El pedido no tiene correo de comprador.' } satisfies EmailSendResult
  }

  const { subject, html } = emailPagoConfirmado({
    compradorNombre: opts.compradorNombre,
    numeroPedido: opts.numeroPedido,
    prendaNombre: opts.prendaNombre,
    montoTotal: opts.montoTotal,
    tiendaNombre: opts.tiendaNombre,
    metodoEnvio: opts.metodoEnvio,
    direccion: opts.direccion,
    trackingUrl: buildOrderTrackingUrl({ id: opts.pedidoId, numero: opts.numeroPedido }),
  })
  return enviarEmail({
    to: opts.compradorEmail,
    subject,
    html,
    tag: 'pago_confirmado',
    replyTo: opts.tiendaEmail,
    idempotencyKey: `pago-confirmado-${opts.numeroPedido}`,
  })
}

// ────────────────────────────────────────────────────────
// 3. PAGO RECHAZADO - comprador
// ────────────────────────────────────────────────────────
export async function notificarPagoRechazado(opts: {
  compradorEmail?: string | null
  compradorNombre: string
  numeroPedido: string
  prendaNombre: string
  tiendaNombre: string
  tiendaEmail?: string | null
  notasRechazo?: string | null
}) {
  if (!opts.compradorEmail) return

  const { subject, html } = emailPagoRechazado({
    compradorNombre: opts.compradorNombre,
    numeroPedido: opts.numeroPedido,
    prendaNombre: opts.prendaNombre,
    tiendaNombre: opts.tiendaNombre,
    notasRechazo: opts.notasRechazo,
  })
  await enviarEmail({
    to: opts.compradorEmail,
    subject,
    html,
    tag: 'pago_rechazado',
    replyTo: opts.tiendaEmail,
    idempotencyKey: `pago-rechazado-${opts.numeroPedido}`,
  })
}

// ────────────────────────────────────────────────────────
// 4. CAMBIO DE ESTADO (empacado / en_camino / entregado) - comprador
// ────────────────────────────────────────────────────────
export async function notificarCambioEstado(opts: {
  compradorEmail?: string | null
  compradorNombre: string
  pedidoId: string
  numeroPedido: string
  prendaNombre: string
  tiendaNombre: string
  tiendaEmail?: string | null
  nuevoEstado: 'empacado' | 'en_camino'
  direccion?: string | null
  metodoEnvio?: string | null
  trackingNumero?: string | null
  trackingUrlEnvio?: string | null
}) {
  if (!opts.compradorEmail) return

  const { subject, html } = emailActualizacionEstado({
    compradorNombre: opts.compradorNombre,
    numeroPedido: opts.numeroPedido,
    prendaNombre: opts.prendaNombre,
    tiendaNombre: opts.tiendaNombre,
    nuevoEstado: opts.nuevoEstado,
    direccion: opts.direccion,
    metodoEnvio: opts.metodoEnvio,
    trackingUrl: buildOrderTrackingUrl({ id: opts.pedidoId, numero: opts.numeroPedido }),
    trackingNumero: opts.trackingNumero,
    trackingUrlEnvio: opts.trackingUrlEnvio,
  })
  await enviarEmail({
    to: opts.compradorEmail,
    subject,
    html,
    tag: `estado_${opts.nuevoEstado}`,
    replyTo: opts.tiendaEmail,
    idempotencyKey: `estado-${opts.nuevoEstado}-${opts.numeroPedido}`,
  })
}

export async function notificarSuscriptoresNuevoDrop(opts: {
  suscriptores: { nombre: string; email: string }[];
  tiendaNombre: string;
  tiendaUsername: string;
  dropId: string;
  dropNombre: string;
  descripcion?: string | null;
}) {
  const dropUrl = `${APP_URL}/${opts.tiendaUsername}/drop/${opts.dropId}`;
  const results = await Promise.allSettled(
    opts.suscriptores
      .filter(s => normalizarEmail(s.email))
      .map(s => {
        const { subject, html } = emailNuevoDropActivo({
          tiendaNombre: opts.tiendaNombre,
          dropNombre: opts.dropNombre,
          dropUrl,
          descripcion: opts.descripcion,
        });
        return enviarEmail({
          to: s.email,
          subject,
          html,
          tag: 'nuevo_drop',
          idempotencyKey: `nuevo-drop-${opts.dropId}-${s.email}`,
        });
      })
  );
  return results;
}
