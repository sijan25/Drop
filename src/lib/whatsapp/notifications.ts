import { sendWhatsAppText, type WhatsAppSendResult } from './client'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

function lps(n: number) {
  return `L ${n.toLocaleString('es-HN')}`
}

// ── 1. NUEVO PEDIDO → tienda ─────────────────────────────
export async function wsNuevoPedido(opts: {
  tiendaWhatsApp?: string | null
  tiendaNombre: string
  numeroPedido: string
  compradorNombre: string
  compradorTelefono: string
  prendaNombre: string
  montoTotal: number
  metodoPago: string
  dashboardUrl?: string
}): Promise<WhatsAppSendResult> {
  const msg = [
    `🛍️ *Nuevo pedido — ${opts.tiendaNombre}*`,
    ``,
    `Pedido: *${opts.numeroPedido}*`,
    `Prenda: ${opts.prendaNombre}`,
    `Total: *${lps(opts.montoTotal)}*`,
    `Pago: ${opts.metodoPago}`,
    ``,
    `Comprador: ${opts.compradorNombre}`,
    `WhatsApp: ${opts.compradorTelefono}`,
    ``,
    `👉 ${opts.dashboardUrl ?? `${APP_URL}/comprobantes`}`,
  ].join('\n')

  return sendWhatsAppText(opts.tiendaWhatsApp, msg)
}

// ── 2. PAGO CONFIRMADO → comprador ───────────────────────
export async function wsPagoConfirmado(opts: {
  compradorWhatsApp?: string | null
  compradorNombre: string
  numeroPedido: string
  prendaNombre: string
  montoTotal: number
  tiendaNombre: string
  trackingUrl?: string | null
}): Promise<WhatsAppSendResult> {
  const msg = [
    `✅ *¡Tu pago fue confirmado!*`,
    ``,
    `Hola ${opts.compradorNombre}, la tienda *${opts.tiendaNombre}* verificó tu comprobante.`,
    ``,
    `Pedido: *${opts.numeroPedido}*`,
    `Prenda: ${opts.prendaNombre}`,
    `Total pagado: *${lps(opts.montoTotal)}*`,
    ``,
    opts.trackingUrl ? `🔍 Seguimiento: ${opts.trackingUrl}` : '',
  ].filter(Boolean).join('\n')

  return sendWhatsAppText(opts.compradorWhatsApp, msg)
}

// ── 3. PAGO RECHAZADO → comprador ────────────────────────
export async function wsPagoRechazado(opts: {
  compradorWhatsApp?: string | null
  compradorNombre: string
  numeroPedido: string
  prendaNombre: string
  tiendaNombre: string
  notasRechazo?: string | null
}): Promise<WhatsAppSendResult> {
  const msg = [
    `❌ *Comprobante no verificado*`,
    ``,
    `Hola ${opts.compradorNombre}, no pudimos verificar tu comprobante del pedido *${opts.numeroPedido}* en *${opts.tiendaNombre}*.`,
    ``,
    `Prenda: ${opts.prendaNombre}`,
    opts.notasRechazo ? `Motivo: ${opts.notasRechazo}` : '',
    ``,
    `Si crees que hubo un error, contactá directamente a la tienda.`,
  ].filter(Boolean).join('\n')

  return sendWhatsAppText(opts.compradorWhatsApp, msg)
}

// ── 4. CAMBIO DE ESTADO → comprador ──────────────────────
export async function wsCambioEstado(opts: {
  compradorWhatsApp?: string | null
  compradorNombre: string
  numeroPedido: string
  prendaNombre: string
  tiendaNombre: string
  nuevoEstado: 'empacado' | 'en_camino'
  trackingUrl?: string | null
  trackingNumero?: string | null
  trackingUrlEnvio?: string | null
}): Promise<WhatsAppSendResult> {
  const ESTADOS = {
    empacado: { emoji: '📦', texto: 'Tu pedido está empacado y listo.' },
    en_camino: { emoji: '🚚', texto: '¡Tu pedido fue enviado! Llegará pronto.' },
  }
  const { emoji, texto } = ESTADOS[opts.nuevoEstado]

  const msg = [
    `${emoji} *${texto}*`,
    ``,
    `Hola ${opts.compradorNombre}, hay novedades de tu pedido en *${opts.tiendaNombre}*.`,
    ``,
    `Pedido: *${opts.numeroPedido}*`,
    `Prenda: ${opts.prendaNombre}`,
    opts.nuevoEstado === 'en_camino' && opts.trackingNumero ? `Guía de envío: *${opts.trackingNumero}*` : '',
    opts.nuevoEstado === 'en_camino' && opts.trackingUrlEnvio ? `Rastrear: ${opts.trackingUrlEnvio}` : '',
    ``,
    opts.trackingUrl ? `🔍 Seguimiento pedido: ${opts.trackingUrl}` : '',
  ].filter(Boolean).join('\n')

  return sendWhatsAppText(opts.compradorWhatsApp, msg)
}
