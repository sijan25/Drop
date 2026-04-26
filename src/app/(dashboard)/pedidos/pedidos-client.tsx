'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Icons } from '@/components/shared/icons'
import { ConfirmModal } from '@/components/shared/confirm-modal'
import { ModalOverlay } from '@/components/shared/modal-overlay'
import { avanzarEstado, cancelarPedido, reenviarCorreoPagoConfirmado } from './actions'

function TrackingModal({
  onConfirm, onClose, loading,
}: {
  onConfirm: (tracking: { numero: string; url: string }) => void
  onClose: () => void
  loading: boolean
}) {
  const [numero, setNumero] = useState('')
  const [url, setUrl] = useState('')
  return (
    <ModalOverlay onClose={onClose} maxWidth={420}>
      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Marcar como enviado</div>
          <button onClick={onClose} style={{ color: 'var(--ink-3)', background: 'none', border: 'none', cursor: 'pointer' }}>
            <Icons.close width={16} height={16} />
          </button>
        </div>
        <div style={{ display: 'grid', gap: 14 }}>
          <div>
            <label className="label">Número de guía <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}>(opcional)</span></label>
            <input
              className="input mono"
              placeholder="ej. 1234567890"
              value={numero}
              onChange={e => setNumero(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Link de rastreo <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}>(opcional)</span></label>
            <input
              className="input"
              placeholder="https://..."
              value={url}
              onChange={e => setUrl(e.target.value)}
            />
          </div>
        </div>
        <p style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 12, marginBottom: 18, lineHeight: 1.5 }}>
          Si ingresás estos datos, el comprador los recibirá por email y WhatsApp.
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn btn-outline btn-sm">Cancelar</button>
          <button
            onClick={() => onConfirm({ numero, url })}
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
  return [p.marca, p.nombre, item?.talla_seleccionada ?? p.talla].filter(Boolean).join(' · ')
}

function dropLabel(drop: Drop | null) {
  if (!drop) return '—'
  const m = drop.nombre.match(/\d+/)
  return m ? `#${m[0]}` : drop.nombre
}

export default function PedidosClient({
  pedidos, semanaCount, transitoTotal,
}: {
  pedidos: Pedido[]
  semanaCount: number
  transitoTotal: number
}) {
  const router = useRouter()
  const [expanded, setExpanded] = useState<string | null>(pedidos[0]?.numero ?? null)
  const [message, setMessage] = useState<{ pedidoId: string; tone: 'ok' | 'error'; text: string } | null>(null)
  const [pending, startTransition] = useTransition()
  const [confirmCancelar, setConfirmCancelar] = useState<string | null>(null)
  const [trackingPedido, setTrackingPedido] = useState<{ id: string; estado: string } | null>(null)

  function handleAvanzar(pedidoId: string, estado: string) {
    if (estado === 'empacado') {
      setTrackingPedido({ id: pedidoId, estado })
      return
    }
    startTransition(async () => {
      setMessage(null)
      const result = await avanzarEstado(pedidoId, estado)
      if (result && 'error' in result) {
        setMessage({ pedidoId, tone: 'error', text: result.error ?? 'No se pudo avanzar el estado.' })
      }
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
      }
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
      }
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

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '20px 28px 16px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.015em' }}>Pedidos</div>
          <div className="t-mute" style={{ fontSize: 13, marginTop: 3 }}>
            {semanaCount} pedidos esta semana · L {transitoTotal.toLocaleString()} en tránsito
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline btn-sm"><Icons.filter width={13} height={13}/> Filtros</button>
          <button className="btn btn-outline btn-sm">Exportar</button>
        </div>
      </div>

      {trackingPedido && (
        <TrackingModal
          loading={pending}
          onConfirm={confirmarTracking}
          onClose={() => setTrackingPedido(null)}
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

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }}>
        {pedidos.length === 0 ? (
          <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>
            Sin pedidos todavía
          </div>
        ) : (
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '90px 1.2fr 1.6fr 90px 80px 110px 110px 28px', padding: '10px 16px', borderBottom: '1px solid var(--line)', fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: 0.04 }} className="mono">
              <div>Pedido</div><div>Comprador</div><div>Prenda</div><div>Drop</div><div>Monto</div><div>Fecha</div><div>Estado</div><div/>
            </div>

            {pedidos.map((r, i) => (
              <div key={r.id}>
                <div
                  onClick={() => setExpanded(e => e === r.numero ? null : r.numero)}
                  style={{ display: 'grid', gridTemplateColumns: '90px 1.2fr 1.6fr 90px 80px 110px 110px 28px', padding: '12px 16px', borderBottom: i < pedidos.length - 1 ? '1px solid var(--line-2)' : 'none', alignItems: 'center', fontSize: 12, cursor: 'pointer' }}
                >
                  <div className="mono tnum" style={{ fontWeight: 500 }}>{r.numero}</div>
                  <div>{r.comprador_nombre}</div>
                  <div className="t-mute">{prendaLabel(r.items)}</div>
                  <div className="mono t-mute">{dropLabel(r.drop)}</div>
                  <div className="mono tnum" style={{ fontWeight: 500 }}>L {r.monto_total.toLocaleString()}</div>
                  <div className="t-mute">{fmt(r.created_at)}</div>
                  <div><span className={badgeClass(r.estado)}>{estadoLabel(r.estado)}</span></div>
                  <div style={{ transform: expanded === r.numero ? 'rotate(90deg)' : 'none', transition: 'transform .15s', color: 'var(--ink-3)' }}>
                    <Icons.arrow width={13} height={13}/>
                  </div>
                </div>

                {expanded === r.numero && (
                  <div style={{ padding: '18px 24px 22px', background: 'var(--surface-2)', borderBottom: '1px solid var(--line)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                      {/* Timeline */}
                      <div>
                        <div className="mono t-mute" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.06, marginBottom: 10 }}>Timeline</div>
                        <div style={{ display: 'grid', gap: 10 }}>
                          {[
                            { t: 'Pagado',   d: r.pagado_at },
                            { t: 'Empacado', d: r.empacado_at },
                            { t: 'Enviado',  d: r.en_camino_at },
                          ].map(({ t, d }) => (
                            <div key={t} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                              <div style={{ width: 14, height: 14, borderRadius: 7, background: d ? 'var(--ink)' : '#fff', border: d ? 'none' : '1.5px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                {d && <Icons.check width={8} height={8} style={{ color: '#fff' }}/>}
                              </div>
                              <div style={{ flex: 1, fontSize: 12, fontWeight: d ? 500 : 400, color: d ? 'var(--ink)' : 'var(--ink-3)' }}>{t}</div>
                              <div className="mono t-mute" style={{ fontSize: 11 }}>{fmt(d)}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Entrega */}
                      <div>
                        <div className="mono t-mute" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.06, marginBottom: 10 }}>Entrega</div>
                        <div style={{ fontSize: 12, lineHeight: 1.6 }}>
                          <div><span className="t-mute">WhatsApp:</span> <span className="mono">{r.comprador_telefono}</span></div>
                          {r.direccion && <div><span className="t-mute">Dirección:</span> {r.direccion}</div>}
                          <div><span className="t-mute">Método:</span> {r.metodo_envio === 'domicilio' ? 'Envío a domicilio' : 'Pickup en tienda'}</div>
                          {r.tracking_numero && (
                            <div style={{ marginTop: 6 }}>
                              <span className="t-mute">Guía:</span>{' '}
                              {r.tracking_url
                                ? <a href={r.tracking_url} target="_blank" rel="noreferrer" className="mono" style={{ color: '#16a34a', fontWeight: 600 }}>{r.tracking_numero}</a>
                                : <span className="mono" style={{ fontWeight: 600 }}>{r.tracking_numero}</span>
                              }
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
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
                              <Icons.upload width={13} height={13}/> {actionLabel[r.estado ?? '']}
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
                              className="btn btn-outline btn-sm"
                              style={{ color: 'var(--urgent)', borderColor: '#fecaca' }}
                            >
                              Cancelar
                            </button>
                          )}
                        </div>
                        {message?.pedidoId === r.id && (
                          <div style={{
                            marginTop: 10,
                            padding: '9px 11px',
                            borderRadius: 8,
                            fontSize: 12,
                            lineHeight: 1.45,
                            color: message.tone === 'ok' ? '#065f46' : '#991b1b',
                            background: message.tone === 'ok' ? '#ecfdf5' : '#fef2f2',
                            border: `1px solid ${message.tone === 'ok' ? '#a7f3d0' : '#fecaca'}`,
                          }}>
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
