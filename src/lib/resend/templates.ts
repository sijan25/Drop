/** Templates HTML para los emails de Droppi */

const BASE_STYLE = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
  background: #f9f9f7;
  margin: 0;
  padding: 0;
`

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char] ?? char))
}

function layout(content: string, tiendaNombre = 'Droppi') {
  const safeTiendaNombre = escapeHtml(tiendaNombre)

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTiendaNombre}</title>
</head>
<body style="${BASE_STYLE}">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
    <!-- Header -->
    <tr>
      <td style="background:#0a0a0a;padding:24px 32px;">
        <span style="color:#fff;font-size:18px;font-weight:700;letter-spacing:-0.02em;">${safeTiendaNombre}</span>
      </td>
    </tr>
    <!-- Content -->
    <tr>
      <td style="padding:32px;">
        ${content}
      </td>
    </tr>
    <!-- Footer -->
    <tr>
      <td style="padding:20px 32px;border-top:1px solid #f0f0ee;background:#fafaf8;">
        <p style="margin:0;font-size:12px;color:#999;line-height:1.6;">
          Este email fue enviado automáticamente por ${safeTiendaNombre}.<br/>
          Si tenés alguna duda, respondé a este email o escribinos por WhatsApp.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
`
}

function badge(texto: string, color = '#0a0a0a') {
  return `<span style="display:inline-block;background:${color};color:#fff;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;padding:4px 12px;border-radius:20px;">${escapeHtml(texto)}</span>`
}

function infoRow(label: string, value: string) {
  return `
  <tr>
    <td style="padding:10px 0;border-bottom:1px solid #f0f0ee;">
      <span style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.06em;">${escapeHtml(label)}</span><br/>
      <span style="font-size:15px;font-weight:600;color:#0a0a0a;">${escapeHtml(value)}</span>
    </td>
  </tr>`
}

// ────────────────────────────────────────────────────────
// 1. PEDIDO CONFIRMADO (para el comprador)
// ────────────────────────────────────────────────────────
export function emailPedidoConfirmado(opts: {
  compradorNombre: string
  numeroPedido: string
  prendaNombre: string
  prendaMarca?: string | null
  prendaTalla?: string | null
  montoTotal: number
  tiendaNombre: string
  tiendaUsername: string
  metodoPago: string
  metodoEnvio: string
  direccion?: string | null
  comprobanteSubido: boolean
  trackingUrl?: string | null
}) {
  const estadoLabel = opts.comprobanteSubido
    ? 'Por verificar'
    : 'Apartado (48h)'
  const estadoColor = opts.comprobanteSubido ? '#1d4ed8' : '#92400e'

  const content = `
    <h1 style="font-size:24px;font-weight:700;margin:0 0 4px;letter-spacing:-0.02em;color:#0a0a0a;">
      ¡Gracias por tu compra! 🎉
    </h1>
    <p style="font-size:15px;color:#555;margin:0 0 28px;line-height:1.6;">
      Hola <strong>${escapeHtml(opts.compradorNombre)}</strong>, recibimos tu pedido en <strong>${escapeHtml(opts.tiendaNombre)}</strong>.
    </p>

    <div style="background:#f9f9f7;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <span style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.06em;">Número de pedido</span>
        ${badge(estadoLabel, estadoColor)}
      </div>
      <div style="font-size:28px;font-weight:700;font-family:monospace;letter-spacing:-0.02em;color:#0a0a0a;margin-bottom:4px;">
        ${escapeHtml(opts.numeroPedido)}
      </div>
    </div>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      ${infoRow('Prenda', `${opts.prendaNombre}${opts.prendaMarca ? ` · ${opts.prendaMarca}` : ''}${opts.prendaTalla ? ` · Talla ${opts.prendaTalla}` : ''}`)}
      ${infoRow('Total', `L ${opts.montoTotal.toLocaleString('es-HN')}`)}
      ${infoRow('Método de pago', opts.metodoPago)}
      ${infoRow('Envío', opts.metodoEnvio)}
      ${opts.direccion ? infoRow('Dirección', opts.direccion) : ''}
    </table>

    ${opts.comprobanteSubido
      ? `<div style="background:#eff6ff;border-radius:10px;padding:16px 20px;margin-bottom:20px;border-left:3px solid #3b82f6;">
          <p style="margin:0;font-size:14px;color:#1e40af;line-height:1.6;">
            <strong>Comprobante recibido.</strong> La tienda verificará tu pago y te notificaremos por email cuando esté confirmado.
          </p>
        </div>`
      : `<div style="background:#fffbeb;border-radius:10px;padding:16px 20px;margin-bottom:20px;border-left:3px solid #f59e0b;">
          <p style="margin:0;font-size:14px;color:#92400e;line-height:1.6;">
            <strong>Apartado por 48 horas.</strong> Enviá tu comprobante de pago a la tienda para confirmar tu pedido antes de que expire el apartado.
          </p>
        </div>`
    }

    <p style="font-size:14px;color:#555;margin:0;line-height:1.6;">
      Te avisaremos por email cuando haya actualizaciones en tu pedido. Si tenés dudas, escribinos por WhatsApp.
    </p>

    ${opts.trackingUrl
      ? `<div style="margin-top:22px;">
          <a href="${escapeHtml(opts.trackingUrl)}" style="display:inline-block;background:#0a0a0a;color:#fff;font-size:14px;font-weight:600;padding:13px 22px;border-radius:10px;text-decoration:none;">
            Ver seguimiento
          </a>
        </div>`
      : ''
    }
  `

  return {
    subject: `Pedido ${opts.numeroPedido} recibido · ${opts.tiendaNombre}`,
    html: layout(content, opts.tiendaNombre),
  }
}

// ────────────────────────────────────────────────────────
// 2. NUEVO PEDIDO (para el vendedor/tienda)
// ────────────────────────────────────────────────────────
export function emailNuevoPedidoVendedor(opts: {
  tiendaNombre: string
  numeroPedido: string
  compradorNombre: string
  compradorTelefono: string
  compradorEmail?: string | null
  prendaNombre: string
  montoTotal: number
  metodoPago: string
  metodoEnvio: string
  direccion?: string | null
  comprobanteUrl?: string | null
  dashboardUrl: string
}) {
  const content = `
    <h1 style="font-size:22px;font-weight:700;margin:0 0 4px;letter-spacing:-0.02em;color:#0a0a0a;">
      Nuevo pedido recibido
    </h1>
    <p style="font-size:15px;color:#555;margin:0 0 28px;line-height:1.6;">
      Tienes un nuevo pedido en <strong>${escapeHtml(opts.tiendaNombre)}</strong>.
    </p>

    <div style="background:#f9f9f7;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
      <div style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Número de pedido</div>
      <div style="font-size:26px;font-weight:700;font-family:monospace;color:#0a0a0a;">
        ${escapeHtml(opts.numeroPedido)}
      </div>
    </div>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      ${infoRow('Prenda', opts.prendaNombre)}
      ${infoRow('Total', `L ${opts.montoTotal.toLocaleString('es-HN')}`)}
      ${infoRow('Comprador', opts.compradorNombre)}
      ${infoRow('WhatsApp', opts.compradorTelefono)}
      ${opts.compradorEmail ? infoRow('Email', opts.compradorEmail) : ''}
      ${infoRow('Método de pago', opts.metodoPago)}
      ${infoRow('Envío', opts.metodoEnvio)}
      ${opts.direccion ? infoRow('Dirección de entrega', opts.direccion) : ''}
    </table>

    ${opts.comprobanteUrl
      ? `<div style="margin-bottom:20px;">
          <a href="${escapeHtml(opts.comprobanteUrl)}" style="display:inline-block;background:#f0f0ee;color:#0a0a0a;font-size:13px;font-weight:600;padding:10px 18px;border-radius:8px;text-decoration:none;">
            Ver comprobante adjunto
          </a>
        </div>`
      : ''
    }

    <a href="${escapeHtml(opts.dashboardUrl)}" style="display:inline-block;background:#0a0a0a;color:#fff;font-size:14px;font-weight:600;padding:14px 28px;border-radius:10px;text-decoration:none;letter-spacing:-0.01em;">
      Ir al dashboard
    </a>
  `

  return {
    subject: `Nuevo pedido ${opts.numeroPedido} · ${opts.tiendaNombre}`,
    html: layout(content, opts.tiendaNombre),
  }
}

// ────────────────────────────────────────────────────────
// 3. PAGO CONFIRMADO (para el comprador)
// ────────────────────────────────────────────────────────
export function emailPagoConfirmado(opts: {
  compradorNombre: string
  numeroPedido: string
  prendaNombre: string
  montoTotal: number
  tiendaNombre: string
  metodoEnvio: string
  direccion?: string | null
  trackingUrl?: string | null
}) {
  const content = `
    <h1 style="font-size:24px;font-weight:700;margin:0 0 4px;letter-spacing:-0.02em;color:#0a0a0a;">
      ✅ ¡Tu pago fue confirmado!
    </h1>
    <p style="font-size:15px;color:#555;margin:0 0 28px;line-height:1.6;">
      Hola <strong>${escapeHtml(opts.compradorNombre)}</strong>, la tienda verificó tu comprobante y tu pago está confirmado.
    </p>

    <div style="background:#ecfdf5;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
      <div style="font-size:12px;color:#065f46;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Pedido</div>
      <div style="font-size:26px;font-weight:700;font-family:monospace;color:#065f46;">
        ${escapeHtml(opts.numeroPedido)}
      </div>
    </div>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      ${infoRow('Prenda', opts.prendaNombre)}
      ${infoRow('Total pagado', `L ${opts.montoTotal.toLocaleString('es-HN')}`)}
      ${infoRow('Envío', opts.metodoEnvio)}
      ${opts.direccion ? infoRow('Dirección', opts.direccion) : ''}
    </table>

    <div style="background:#f9f9f7;border-radius:10px;padding:16px 20px;margin-bottom:20px;">
      <p style="margin:0;font-size:14px;color:#555;line-height:1.6;">
        📦 La tienda está preparando tu pedido. Te avisaremos por email cuando esté en camino.
      </p>
    </div>

    ${opts.trackingUrl
      ? `<a href="${escapeHtml(opts.trackingUrl)}" style="display:inline-block;background:#0a0a0a;color:#fff;font-size:14px;font-weight:600;padding:13px 22px;border-radius:10px;text-decoration:none;">
          Ver seguimiento
        </a>`
      : ''
    }
  `

  return {
    subject: `Pago confirmado · Pedido ${opts.numeroPedido}`,
    html: layout(content, opts.tiendaNombre),
  }
}

// ────────────────────────────────────────────────────────
// 4. PAGO RECHAZADO (para el comprador)
// ────────────────────────────────────────────────────────
export function emailPagoRechazado(opts: {
  compradorNombre: string
  numeroPedido: string
  prendaNombre: string
  tiendaNombre: string
  notasRechazo?: string | null
}) {
  const content = `
    <h1 style="font-size:24px;font-weight:700;margin:0 0 4px;letter-spacing:-0.02em;color:#0a0a0a;">
      ❌ Comprobante no verificado
    </h1>
    <p style="font-size:15px;color:#555;margin:0 0 28px;line-height:1.6;">
      Hola <strong>${escapeHtml(opts.compradorNombre)}</strong>, lamentablemente no pudimos verificar tu comprobante de pago del pedido <strong>${escapeHtml(opts.numeroPedido)}</strong>.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      ${infoRow('Pedido', opts.numeroPedido)}
      ${infoRow('Prenda', opts.prendaNombre)}
      ${opts.notasRechazo ? infoRow('Motivo', opts.notasRechazo) : ''}
    </table>

    <div style="background:#fef2f2;border-radius:10px;padding:16px 20px;margin-bottom:20px;border-left:3px solid #ef4444;">
      <p style="margin:0;font-size:14px;color:#991b1b;line-height:1.6;">
        <strong>Tu pedido fue cancelado</strong> y la prenda volvió al catálogo. Si creés que hubo un error, contactá a la tienda directamente por WhatsApp.
      </p>
    </div>

    <p style="font-size:14px;color:#555;margin:0;line-height:1.6;">
      Podés volver a intentar la compra si la prenda aún está disponible.
    </p>
  `

  return {
    subject: `Comprobante no verificado · Pedido ${opts.numeroPedido}`,
    html: layout(content, opts.tiendaNombre),
  }
}

// ────────────────────────────────────────────────────────
// 5. ACTUALIZACIÓN DE ESTADO (comprador)
// ────────────────────────────────────────────────────────
export function emailActualizacionEstado(opts: {
  compradorNombre: string
  numeroPedido: string
  prendaNombre: string
  tiendaNombre: string
  nuevoEstado: 'empacado' | 'en_camino'
  direccion?: string | null
  metodoEnvio?: string | null
  trackingUrl?: string | null
}) {
  const esPickup = opts.metodoEnvio === 'pickup'
  const diasEstimados = esPickup ? null : '3 a 5 días hábiles'

  const ESTADOS = {
    empacado: {
      emoji: '📦',
      titulo: 'Tu pedido está empacado',
      descripcion: 'Tu pedido ya está listo y empacado. Pronto saldrá para entrega.',
      extra: null,
    },
    en_camino: {
      emoji: '🚚',
      titulo: '¡Tu pedido fue enviado!',
      descripcion: esPickup
        ? 'Tu pedido ya está listo para retirar en tienda.'
        : `Tu pedido ya salió para entrega. Llegará en aproximadamente <strong>${diasEstimados}</strong>.`,
      extra: opts.direccion && !esPickup
        ? `<div style="background:#eff6ff;border-radius:10px;padding:16px 20px;margin-top:12px;border-left:3px solid #3b82f6;">
            <p style="margin:0;font-size:14px;color:#1e40af;line-height:1.6;">
              📍 <strong>Dirección de entrega:</strong> ${escapeHtml(opts.direccion)}
            </p>
          </div>`
        : null,
    },
  }

  const estado = ESTADOS[opts.nuevoEstado]

  const content = `
    <h1 style="font-size:24px;font-weight:700;margin:0 0 4px;letter-spacing:-0.02em;color:#0a0a0a;">
      ${estado.emoji} ${estado.titulo}
    </h1>
    <p style="font-size:15px;color:#555;margin:0 0 28px;line-height:1.6;">
      Hola <strong>${escapeHtml(opts.compradorNombre)}</strong>, hay novedades sobre tu pedido.
    </p>

    <div style="background:#f9f9f7;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
      <div style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Pedido</div>
      <div style="font-size:26px;font-weight:700;font-family:monospace;color:#0a0a0a;">
        ${escapeHtml(opts.numeroPedido)}
      </div>
    </div>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      ${infoRow('Prenda', opts.prendaNombre)}
      ${opts.metodoEnvio ? infoRow('Método de envío', esPickup ? 'Pickup / Retiro en tienda' : 'Envío a domicilio') : ''}
      ${diasEstimados ? infoRow('Tiempo estimado', diasEstimados) : ''}
    </table>

    <div style="background:#f9f9f7;border-radius:10px;padding:16px 20px;">
      <p style="margin:0;font-size:14px;color:#555;line-height:1.6;">
        ${estado.descripcion}
      </p>
    </div>

    ${estado.extra ?? ''}

    ${opts.trackingUrl
      ? `<div style="margin-top:20px;">
          <a href="${escapeHtml(opts.trackingUrl)}" style="display:inline-block;background:#0a0a0a;color:#fff;font-size:14px;font-weight:600;padding:13px 22px;border-radius:10px;text-decoration:none;">
            Ver seguimiento
          </a>
        </div>`
      : ''
    }
  `

  return {
    subject: `${estado.emoji} ${estado.titulo} · ${opts.numeroPedido}`,
    html: layout(content, opts.tiendaNombre),
  }
}
