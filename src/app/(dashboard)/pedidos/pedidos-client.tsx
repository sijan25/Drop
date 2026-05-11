'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Icons } from '@/components/shared/icons'
import { ConfirmModal } from '@/components/shared/confirm-modal'
import { ModalOverlay } from '@/components/shared/modal-overlay'
import { avanzarEstado, cancelarPedido, reenviarCorreoPagoConfirmado } from './actions'

function TrackingModal({
  onConfirm, onClose, loading, baseTrackingUrl,
}: {
  onConfirm: (tracking: { numero: string; url: string }) => void
  onClose: () => void
  loading: boolean
  baseTrackingUrl?: string | null
}) {
  const [numero, setNumero] = useState('')
  const [urlManual, setUrlManual] = useState('')

  const urlGenerada = baseTrackingUrl && numero.trim()
    ? baseTrackingUrl.replace(/=?$/, '') + numero.trim()
    : ''
  const urlFinal = urlGenerada || urlManual

  return (
    <ModalOverlay onClose={onClose} maxWidth={420}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-[18px]">
          <div className="text-[16px] font-bold">Marcar como enviado</div>
          <button onClick={onClose} className="text-[var(--ink-3)] bg-none border-none cursor-pointer">
            <Icons.close width={16} height={16} />
          </button>
        </div>
        <div className="grid gap-[14px]">
          <div>
            <label className="label">Número de guía <span className="text-[var(--ink-3)] font-normal">(opcional)</span></label>
            <input
              className="input mono"
              placeholder="ej. 1234567890"
              value={numero}
              onChange={e => setNumero(e.target.value)}
            />
          </div>
          {baseTrackingUrl ? (
            urlGenerada ? (
              <div className="text-[12px] text-[var(--ink-3)] bg-[var(--surface-2)] rounded-lg px-3 py-2 leading-[1.5]">
                Link generado: <a href={urlGenerada} target="_blank" rel="noreferrer" className="text-[var(--accent)] break-all">{urlGenerada}</a>
              </div>
            ) : null
          ) : (
            <div>
              <label className="label">Link de rastreo <span className="text-[var(--ink-3)] font-normal">(opcional)</span></label>
              <input
                className="input"
                placeholder="https://..."
                value={urlManual}
                onChange={e => setUrlManual(e.target.value)}
              />
            </div>
          )}
        </div>
        <p className="text-[12px] text-[var(--ink-3)] mt-3 mb-[18px] leading-[1.5]">
          Si ingresás estos datos, el comprador los recibirá por email y WhatsApp.
        </p>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="btn btn-outline btn-sm">Cancelar</button>
          <button
            onClick={() => onConfirm({ numero, url: urlFinal })}
            disabled={loading}
            className="btn btn-primary btn-sm"
          >
            {loading ? 'Guardando…' : 'Confirmar envío'}
          </button>
        </div>
      </div>
    </ModalOverlay>
  )
}

type Prenda = { nombre: string; talla: string | null; marca: string | null }
type Item = { id: string; precio: number; talla_seleccionada: string | null; prenda: Prenda | null }
type Drop = { nombre: string }

type Pedido = {
  id: string
  numero: string
  comprador_nombre: string
  comprador_telefono: string
  direccion: string | null
  metodo_envio: string | null
  monto_total: number
  estado: string | null
  created_at: string | null
  pagado_at: string | null
  empacado_at: string | null
  en_camino_at: string | null
  tracking_numero: string | null
  tracking_url: string | null
  envio_proveedor: string | null
  envio_modalidad: string | null
  envio_monto: number | null
  envio_courier_id: string | null
  envio_courier_nombre: string | null
  envio_courier_logo: string | null
  envio_tracking_url: string | null
  envio_label_url: string | null
  envio_estado: string | null
  envio_metadata: unknown
  drop: Drop | null
  items: Item[]
}

function fmt(iso: string | null | undefined): string {
  if (!iso) return 'Pendiente'
  const d = new Date(iso)
  const m = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'][d.getMonth()]
  return `${d.getDate()} ${m} · ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

function estadoLabel(e: string | null) {
  const map: Record<string, string> = {
    apartado: 'Apartado', por_verificar: 'Por verificar',
    pagado: 'Pagado', empacado: 'Empacado',
    en_camino: 'Enviado', cancelado: 'Cancelado',
  }
  return map[e ?? ''] ?? e ?? '—'
}

function badgeClass(e: string | null) {
  if (e === 'por_verificar') return 'badge badge-held'
  if (e === 'pagado') return 'badge badge-ok'
  if (e === 'en_camino') return 'badge badge-sold'
  if (e === 'cancelado') return 'badge badge-danger'
  return 'badge'
}

function prendaLabel(items: Item[]) {
  const item = items[0]
  const p = item?.prenda
  if (!p) return '—'
  return [p.marca, p.nombre].filter(Boolean).join(' · ')
}

function tallaLabel(items: Item[]) {
  if (items.length > 1) {
    const tallas = items.map(i => i.talla_seleccionada ?? i.prenda?.talla).filter(Boolean)
    return tallas.length > 0 ? tallas.join(', ') : '—'
  }
  const item = items[0]
  return item?.talla_seleccionada ?? item?.prenda?.talla ?? '—'
}

function dropLabel(drop: Drop | null) {
  if (!drop) return '—'
  const m = drop.nombre.match(/\d+/)
  return m ? `#${m[0]}` : drop.nombre
}

function isBoxfulPedido(pedido: Pick<Pedido, 'metodo_envio' | 'envio_proveedor' | 'envio_modalidad'>) {
  return pedido.envio_proveedor === 'boxful'
    || pedido.envio_modalidad === 'boxful_dropoff'
    || pedido.envio_modalidad === 'boxful_recoleccion'
    || pedido.metodo_envio === 'boxful_dropoff'
    || pedido.metodo_envio === 'boxful_recoleccion'
}

function metodoEnvioLabel(pedido: Pick<Pedido, 'metodo_envio' | 'envio_modalidad'>) {
  const metodo = pedido.envio_modalidad ?? pedido.metodo_envio
  if (metodo === 'boxful_dropoff') return 'Boxful · Punto autorizado'
  if (metodo === 'boxful_recoleccion') return 'Boxful · Recolección'
  return metodo === 'domicilio' ? 'Envío a domicilio' : 'Pickup en tienda'
}

export default function PedidosClient({
  pedidos, semanaCount, transitoTotal, metodosEnvio,
}: {
  pedidos: Pedido[]
  semanaCount: number
  transitoTotal: number
  metodosEnvio: { id: string; nombre: string; tracking_url: string | null }[]
}) {
  const router = useRouter()
  const shellRef = useRef<HTMLDivElement>(null)
  const [isCompact, setIsCompact] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(pedidos[0]?.numero ?? null)
  const [message, setMessage] = useState<{ pedidoId: string; tone: 'ok' | 'error'; text: string } | null>(null)
  const [pending, startTransition] = useTransition()
  const [confirmCancelar, setConfirmCancelar] = useState<string | null>(null)
  const [trackingPedido, setTrackingPedido] = useState<{ id: string; estado: string; baseTrackingUrl?: string | null } | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')

  useEffect(() => {
    const node = shellRef.current
    if (!node) return
    const update = () => setIsCompact(node.clientWidth <= 900)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const pedidosFiltrados = pedidos.filter(p => {
    const fecha = new Date(p.created_at ?? '')
    if (fechaDesde && fecha < new Date(fechaDesde)) return false
    if (fechaHasta && fecha > new Date(fechaHasta + 'T23:59:59')) return false
    return true
  })

  function exportarCSV() {
    const headers = ['#Pedido', 'Cliente', 'Prenda', 'Talla', 'Drop', 'Monto (L)', 'Fecha', 'Estado']
    const rows = pedidosFiltrados.map(r => [
      r.numero,
      r.comprador_nombre,
      prendaLabel(r.items),
      tallaLabel(r.items),
      dropLabel(r.drop),
      r.monto_total,
      fmt(r.created_at),
      estadoLabel(r.estado),
    ])
    const csv = [headers, ...rows].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pedidos-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleAvanzar(pedidoId: string, estado: string) {
    if (estado === 'empacado') {
      const pedido = pedidos.find(p => p.id === pedidoId)
      if (pedido && isBoxfulPedido(pedido)) {
        startTransition(async () => {
          setMessage(null)
          const result = await avanzarEstado(pedidoId, estado)
          if (result && 'error' in result) {
            setMessage({ pedidoId, tone: 'error', text: result.error ?? 'No se pudo crear la guía de Boxful.' })
            return
          }
          window.dispatchEvent(new Event('fd-dashboard-counts-refresh'))
          router.refresh()
        })
        return
      }

      const metodo = metodosEnvio.find(m =>
        m.nombre.toLowerCase() === (pedido?.metodo_envio ?? '').toLowerCase()
      )
      setTrackingPedido({ id: pedidoId, estado, baseTrackingUrl: metodo?.tracking_url ?? null })
      return
    }
    startTransition(async () => {
      setMessage(null)
      const result = await avanzarEstado(pedidoId, estado)
      if (result && 'error' in result) {
        setMessage({ pedidoId, tone: 'error', text: result.error ?? 'No se pudo avanzar el estado.' })
        return
      }
      window.dispatchEvent(new Event('fd-dashboard-counts-refresh'))
      router.refresh()
    })
  }

  function confirmarTracking(tracking: { numero: string; url: string }) {
    if (!trackingPedido) return
    const { id, estado } = trackingPedido
    setTrackingPedido(null)
    startTransition(async () => {
      setMessage(null)
      const result = await avanzarEstado(id, estado, tracking)
      if (result && 'error' in result) {
        setMessage({ pedidoId: id, tone: 'error', text: result.error ?? 'No se pudo avanzar el estado.' })
        return
      }
      window.dispatchEvent(new Event('fd-dashboard-counts-refresh'))
      router.refresh()
    })
  }

  function handleCancelar(pedidoId: string) {
    setConfirmCancelar(pedidoId)
  }

  function confirmarCancelar(pedidoId: string) {
    startTransition(async () => {
      setMessage(null)
      const result = await cancelarPedido(pedidoId)
      if (result && 'error' in result) {
        setMessage({ pedidoId, tone: 'error', text: result.error ?? 'No se pudo cancelar el pedido.' })
        return
      }
      window.dispatchEvent(new Event('fd-dashboard-counts-refresh'))
      router.refresh()
    })
  }

  function handleReenviarPago(pedidoId: string) {
    startTransition(async () => {
      setMessage(null)
      const result = await reenviarCorreoPagoConfirmado(pedidoId)
      if ('error' in result) {
        setMessage({ pedidoId, tone: 'error', text: result.error ?? 'No pudimos reenviar el correo.' })
        return
      }
      setMessage({ pedidoId, tone: 'ok', text: 'Correo de pago confirmado reenviado.' })
    })
  }

  const actionLabel: Record<string, string> = {
    pagado: 'Marcar empacado',
    empacado: 'Marcar enviado',
  }

  const desktopColumns = '90px 1.2fr 1.4fr 70px 90px 80px 110px 110px 28px'

  return (
    <div ref={shellRef} className="orders-shell h-full flex flex-col overflow-hidden">
      <div className="orders-header px-7 pt-5 pb-4 border-b border-[var(--line)] flex items-end justify-between gap-5 shrink-0">
        <div>
          <div className="text-[20px] font-semibold tracking-[-0.015em]">Pedidos</div>
          <div className="t-mute text-[13px] mt-[3px]">
            {semanaCount} pedidos esta semana · L {transitoTotal.toLocaleString()} en tránsito
          </div>
        </div>
        <div className="orders-header-actions flex gap-2">
          <button className={`btn btn-sm ${showFilters ? 'btn-primary' : 'btn-outline'}`} onClick={() => setShowFilters(v => !v)}>
            <Icons.filter width={13} height={13}/> Filtros{(fechaDesde || fechaHasta) ? ' ·' : ''}
          </button>
          <button className="btn btn-outline btn-sm" onClick={exportarCSV}>Exportar</button>
        </div>
      </div>

      {showFilters && (
        <div className="orders-filters-panel px-7 py-3 border-b border-[var(--line)] bg-[var(--surface-2)] flex gap-4 items-center shrink-0">
          <span className="text-[12px] text-[var(--ink-3)] font-medium">Fecha</span>
          <div className="orders-date-filter flex items-center gap-2">
            <input type="date" className="input h-8 text-[12px] px-[10px] w-[148px]" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} />
            <span className="text-[12px] text-[var(--ink-3)]">→</span>
            <input type="date" className="input h-8 text-[12px] px-[10px] w-[148px]" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} />
          </div>
          {(fechaDesde || fechaHasta) && (
            <button className="btn btn-outline btn-sm" onClick={() => { setFechaDesde(''); setFechaHasta('') }}>Limpiar</button>
          )}
          <span className="text-[12px] text-[var(--ink-3)] ml-auto">{pedidosFiltrados.length} resultado{pedidosFiltrados.length !== 1 ? 's' : ''}</span>
        </div>
      )}

      {trackingPedido && (
        <TrackingModal
          loading={pending}
          onConfirm={confirmarTracking}
          onClose={() => setTrackingPedido(null)}
          baseTrackingUrl={trackingPedido.baseTrackingUrl}
        />
      )}

      {confirmCancelar && (
        <ConfirmModal
          title="Cancelar pedido"
          description="Las prendas volverán a estar disponibles en tu inventario. Esta acción no se puede deshacer."
          confirmLabel="Sí, cancelar pedido"
          variant="warning"
          loading={pending}
          onConfirm={() => confirmarCancelar(confirmCancelar)}
          onClose={() => setConfirmCancelar(null)}
        />
      )}

      <div className="orders-content flex-1 overflow-y-auto px-7 py-5">
        {pedidos.length === 0 ? (
          <div className="card p-10 text-center text-[var(--ink-3)]">
            Sin pedidos todavía
          </div>
        ) : (
          <div
            className={`card orders-table-card ${isCompact ? 'overflow-visible grid gap-[10px] border-0 bg-transparent shadow-none' : 'overflow-hidden'}`}
          >
            <div
              className={`mono orders-table-head px-4 py-[10px] border-b border-[var(--line)] text-[11px] text-[var(--ink-3)] uppercase tracking-[0.04em] ${isCompact ? 'hidden' : 'grid'}`}
              style={{ gridTemplateColumns: desktopColumns }}
            >
              <div>Pedido</div><div>Cliente</div><div>Prenda</div><div>Talla</div><div>Drop</div><div>Monto</div><div>Fecha</div><div>Estado</div><div/>
            </div>

            {pedidosFiltrados.length === 0 ? (
              <div className="p-8 text-center text-[var(--ink-3)] text-[13px]">Sin resultados para ese rango de fechas</div>
            ) : pedidosFiltrados.map((r, i) => (
              <div
                className={`orders-card-wrap ${isCompact ? 'overflow-hidden border border-[var(--line)] rounded-[12px] bg-[var(--surface)] shadow-[var(--shadow-sm)]' : ''}`}
                key={r.id}
              >
                <div
                  className="orders-row grid items-center text-[12px] cursor-pointer"
                  onClick={() => setExpanded(e => e === r.numero ? null : r.numero)}
                  style={{
                    gridTemplateColumns: isCompact ? 'minmax(0, 1fr) auto 28px' : desktopColumns,
                    gap: isCompact ? '5px 12px' : undefined,
                    padding: isCompact ? 14 : '12px 16px',
                    borderBottom: !isCompact && i < pedidosFiltrados.length - 1 ? '1px solid var(--line-2)' : 'none',
                  }}
                >
                  <div
                    className="mono tnum orders-number font-medium"
                    style={{ gridColumn: isCompact ? 1 : undefined, gridRow: isCompact ? 1 : undefined }}
                  >{r.numero}</div>
                  <div
                    className={`orders-client ${isCompact ? 'min-w-0 overflow-hidden text-ellipsis whitespace-nowrap font-semibold' : ''}`}
                    style={{ gridColumn: isCompact ? 1 : undefined, gridRow: isCompact ? 2 : undefined }}
                  >{r.comprador_nombre}</div>
                  <div
                    className={`t-mute orders-product ${isCompact ? 'min-w-0 break-words' : ''}`}
                    style={{ gridColumn: isCompact ? 1 : undefined, gridRow: isCompact ? 3 : undefined }}
                  >{prendaLabel(r.items)}</div>
                  <div
                    className={`t-mute orders-size ${isCompact ? 'text-[11px]' : ''}`}
                    style={{ gridColumn: isCompact ? 1 : undefined, gridRow: isCompact ? 4 : undefined }}
                  >
                    {isCompact ? `Talla: ${tallaLabel(r.items)}` : tallaLabel(r.items)}
                  </div>
                  <div
                    className={`mono t-mute orders-drop ${isCompact ? 'text-[11px]' : ''}`}
                    style={{ gridColumn: isCompact ? 1 : undefined, gridRow: isCompact ? 5 : undefined }}
                  >
                    {isCompact ? `Drop: ${dropLabel(r.drop)}` : dropLabel(r.drop)}
                  </div>
                  <div
                    className="mono tnum orders-amount font-medium whitespace-nowrap"
                    style={{ gridColumn: isCompact ? 2 : undefined, gridRow: isCompact ? 1 : undefined, alignSelf: isCompact ? 'start' : undefined }}
                  >L {r.monto_total.toLocaleString()}</div>
                  <div
                    className={`t-mute orders-date ${isCompact ? 'text-[11px]' : ''}`}
                    style={{ gridColumn: isCompact ? 1 : undefined, gridRow: isCompact ? 6 : undefined }}
                  >
                    {isCompact ? `Fecha: ${fmt(r.created_at)}` : fmt(r.created_at)}
                  </div>
                  <div
                    className="orders-status"
                    style={{ gridColumn: isCompact ? '1 / 3' : undefined, gridRow: isCompact ? 7 : undefined, justifySelf: isCompact ? 'start' : undefined, paddingTop: isCompact ? 4 : undefined }}
                  ><span className={badgeClass(r.estado)}>{estadoLabel(r.estado)}</span></div>
                  <div
                    className={`orders-expand-icon text-[var(--ink-3)] transition-transform duration-150 ${expanded === r.numero ? 'rotate-90' : ''}`}
                    style={{ gridColumn: isCompact ? 3 : undefined, gridRow: isCompact ? 1 : undefined, justifySelf: isCompact ? 'end' : undefined, alignSelf: isCompact ? 'start' : undefined }}
                  >
                    <Icons.arrow width={13} height={13}/>
                  </div>
                </div>

                {expanded === r.numero && (
                  <div
                    className={`orders-expanded bg-[var(--surface-2)] ${isCompact ? 'p-[14px] border-t border-[var(--line)]' : 'px-6 pt-[18px] pb-[22px] border-b border-[var(--line)]'}`}
                  >
                    {r.items.length > 0 && (
                      <div className="mb-[18px]">
                        <div className="mono t-mute text-[10px] uppercase tracking-[0.06em] mb-[10px]">Prendas</div>
                        <div className="grid gap-[6px]">
                          {r.items.map(item => (
                            <div key={item.id} className="flex gap-[10px] items-center text-[12px]">
                              <div className="flex-1 font-medium">{item.prenda?.nombre ?? '—'}{item.prenda?.marca ? ` · ${item.prenda.marca}` : ''}</div>
                              <div className="mono t-mute whitespace-nowrap">{(item.talla_seleccionada ?? item.prenda?.talla) ? `T. ${item.talla_seleccionada ?? item.prenda?.talla}` : '—'}</div>
                              <div className="mono tnum whitespace-nowrap font-medium">L {Number(item.precio).toLocaleString()}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div
                      className="orders-expanded-grid grid"
                      style={{ gridTemplateColumns: isCompact ? '1fr' : '1fr 1fr', gap: isCompact ? 18 : 24 }}
                    >
                      {/* Timeline */}
                      <div>
                        <div className="mono t-mute text-[10px] uppercase tracking-[0.06em] mb-[10px]">Timeline</div>
                        <div className="grid gap-[10px]">
                          {[
                            { t: 'Pagado',   d: r.pagado_at },
                            { t: 'Empacado', d: r.empacado_at },
                            { t: 'Enviado',  d: r.en_camino_at },
                          ].map(({ t, d }) => (
                            <div key={t} className="flex gap-[10px] items-center">
                              <div className={`w-[14px] h-[14px] rounded-full flex items-center justify-center shrink-0 ${d ? 'bg-[var(--ink)]' : 'bg-white border-[1.5px] border-[var(--line)]'}`}>
                                {d && <Icons.check width={8} height={8} className="text-white"/>}
                              </div>
                              <div className={`flex-1 text-[12px] ${d ? 'font-medium text-[var(--ink)]' : 'font-normal text-[var(--ink-3)]'}`}>{t}</div>
                              <div className="mono t-mute text-[11px]">{fmt(d)}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Entrega */}
                      <div>
                        <div className="mono t-mute text-[10px] uppercase tracking-[0.06em] mb-[10px]">Entrega</div>
                        <div className="text-[12px] leading-[1.6]">
                          <div><span className="t-mute">WhatsApp:</span> <span className="mono">{r.comprador_telefono}</span></div>
                          {r.direccion && <div><span className="t-mute">Dirección:</span> {r.direccion}</div>}
                          <div><span className="t-mute">Método:</span> {metodoEnvioLabel(r)}</div>
                          {isBoxfulPedido(r) && r.envio_courier_nombre && (
                            <div><span className="t-mute">Courier:</span> {r.envio_courier_nombre}</div>
                          )}
                          {isBoxfulPedido(r) && r.envio_estado && (
                            <div><span className="t-mute">Estado Boxful:</span> {r.envio_estado}</div>
                          )}
                          {(r.tracking_numero || r.envio_tracking_url) && (
                            <div className="mt-[6px]">
                              <span className="t-mute">Guía:</span>{' '}
                              {(r.envio_tracking_url ?? r.tracking_url)
                                ? <a href={(r.envio_tracking_url ?? r.tracking_url)!} target="_blank" rel="noreferrer" className="mono text-[#16a34a] font-semibold">{r.tracking_numero ?? 'Rastrear envío'}</a>
                                : <span className="mono font-semibold">{r.tracking_numero}</span>
                              }
                            </div>
                          )}
                          {r.envio_label_url && (
                            <div>
                              <span className="t-mute">Etiqueta:</span>{' '}
                              <a href={r.envio_label_url} target="_blank" rel="noreferrer" className="text-[var(--accent)] font-semibold">Abrir etiqueta</a>
                            </div>
                          )}
                        </div>
                        <div className={`orders-expanded-actions flex gap-2 mt-[14px] ${isCompact ? 'flex-wrap items-stretch' : ''}`}>
                          {r.estado === 'por_verificar' ? (
                            <button
                              onClick={() => router.push('/comprobantes')}
                              className="btn btn-outline btn-sm"
                            >
                              <Icons.inbox width={13} height={13}/> Ver comprobante
                            </button>
                          ) : actionLabel[r.estado ?? ''] ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleAvanzar(r.id, r.estado!) }}
                              disabled={pending}
                              className="btn btn-primary btn-sm"
                            >
                              <Icons.upload width={13} height={13}/> {r.estado === 'empacado' && isBoxfulPedido(r) ? 'Crear guía Boxful' : actionLabel[r.estado ?? '']}
                            </button>
                          ) : null}
                          <a
                            href={`https://wa.me/${r.comprador_telefono.replace(/\D/g,'')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-outline btn-sm"
                          >
                            <Icons.whatsapp width={13} height={13}/> Chat
                          </a>
                          {['pagado', 'empacado', 'en_camino'].includes(r.estado ?? '') && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleReenviarPago(r.id) }}
                              disabled={pending}
                              className="btn btn-outline btn-sm"
                            >
                              <Icons.mail width={13} height={13}/> Reenviar correo
                            </button>
                          )}
                          {r.estado !== 'cancelado' && r.estado !== 'en_camino' && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleCancelar(r.id) }}
                              disabled={pending}
                              className="btn btn-outline btn-sm text-[var(--urgent)] border-[#fecaca]"
                            >
                              Cancelar
                            </button>
                          )}
                        </div>
                        {message?.pedidoId === r.id && (
                          <div className={`mt-[10px] px-[11px] py-[9px] rounded-lg text-[12px] leading-[1.45] ${message.tone === 'ok' ? 'text-[#065f46] bg-[#ecfdf5] border border-[#a7f3d0]' : 'text-[#991b1b] bg-[#fef2f2] border border-[#fecaca]'}`}>
                            {message.text}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
