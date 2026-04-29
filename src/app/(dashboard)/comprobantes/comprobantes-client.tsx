'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Icons } from '@/components/shared/icons'
import { Ph } from '@/components/shared/image-placeholder'
import { confirmarPago, rechazarPago } from './actions'
import { formatCurrency } from '@/lib/config/platform'

type PrendaItem = {
  id: string
  nombre: string
  marca: string | null
  talla: string | null
  fotos: string[]
}

type PedidoItem = {
  id: string
  precio: number
  talla_seleccionada: string | null
  prenda: PrendaItem | null
}

type Pedido = {
  id: string
  numero: string
  comprador_nombre: string
  comprador_telefono: string
  monto_total: number
  pedido_items: PedidoItem[]
}

type Comprobante = {
  id: string
  pedido_id: string
  imagen_url: string
  estado: string
  monto_declarado: number | null
  banco: string | null
  cuenta_destino: string | null
  referencia: string | null
  fecha_transferencia: string | null
  verificacion_automatica: boolean | null
  coincide_monto: boolean | null
  coincide_cuenta: boolean | null
  coincide_referencia: boolean | null
  created_at: string | null
  pedido: Pedido | null
}

function fmt(iso: string | null | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('es-HN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function ComprobantesClient({ comprobantes, historial }: { comprobantes: Comprobante[]; historial: Comprobante[] }) {
  const router = useRouter()
  const [tab, setTab] = useState<'pendientes' | 'historial'>('pendientes')
  const [idx, setIdx] = useState(0)
  const [decided, setDecided] = useState<'ok' | 'no' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const current = comprobantes[idx]
  const pedido = current?.pedido

  function avanzarTras(ms: number) {
    setTimeout(() => {
      if (idx < comprobantes.length - 1) {
        navSiguiente()
      }
    }, ms)
  }

  function handleConfirmar() {
    if (!current) return
    startTransition(async () => {
      setError(null)
      setNotice(null)
      const result = await confirmarPago(current.id, current.pedido_id)
      if ('error' in result) {
        setError(result.error ?? 'No pudimos confirmar este comprobante.')
        return
      }
      setDecided('ok')
      window.dispatchEvent(new Event('fd-dashboard-counts-refresh'))
      router.refresh()
      if (result.email?.status === 'sent') {
        setNotice('Correo de confirmación enviado al comprador.')
      } else if (result.email?.status === 'failed') {
        setError(`No pudimos enviar el correo al comprador.`)
      }
      avanzarTras(1800)
    })
  }

  function handleRechazar() {
    if (!current) return
    startTransition(async () => {
      setError(null)
      setNotice(null)
      const result = await rechazarPago(current.id, current.pedido_id)
      if ('error' in result) {
        setError(result.error ?? 'No pudimos rechazar este comprobante.')
        return
      }
      setDecided('no')
      window.dispatchEvent(new Event('fd-dashboard-counts-refresh'))
      router.refresh()
      avanzarTras(1800)
    })
  }

  function navAnterior() {
    setIdx(i => Math.max(0, i - 1))
    setDecided(null)
    setError(null)
    setNotice(null)
  }

  function navSiguiente() {
    setIdx(i => Math.min(comprobantes.length - 1, i + 1))
    setDecided(null)
    setError(null)
    setNotice(null)
  }

  const autoOk = current?.verificacion_automatica &&
    current?.coincide_monto && current?.coincide_cuenta && current?.coincide_referencia

  const TABS = [
    { id: 'pendientes', label: 'Por verificar', count: comprobantes.length },
    { id: 'historial',  label: 'Historial',     count: historial.length },
  ] as const

  const tabBar = (
    <div style={{ display: 'flex', gap: 4, padding: '0 28px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
      {TABS.map(t => (
        <button key={t.id} onClick={() => setTab(t.id)} style={{
          padding: '12px 14px 10px',
          fontSize: 13, fontWeight: tab === t.id ? 700 : 500,
          color: tab === t.id ? 'var(--accent-3)' : 'var(--ink-3)',
          borderBottom: `2px solid ${tab === t.id ? 'var(--accent)' : 'transparent'}`,
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'none', lineHeight: 1,
        }}>
          {t.label}
          {t.count > 0 && (
            <span style={{
              minWidth: 17, height: 17, borderRadius: 5, padding: '0 4px',
              background: t.id === 'pendientes' ? 'var(--urgent)' : 'var(--line)',
              color: t.id === 'pendientes' ? '#fff' : 'var(--ink-3)',
              fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-mono)',
            }}>{t.count}</span>
          )}
        </button>
      ))}
    </div>
  )

  if (tab === 'historial') {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '20px 28px 0', flexShrink: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.015em' }}>Comprobantes</div>
        </div>
        {tabBar}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 28px 28px' }}>
          {historial.length === 0 ? (
            <div style={{ paddingTop: 60, textAlign: 'center', color: 'var(--ink-3)' }}>
              <Icons.inbox width={28} height={28} style={{ margin: '0 auto 10px', opacity: 0.4 }}/>
              <div style={{ fontSize: 13 }}>Sin historial todavía</div>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 20, fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--line)' }}>
                  {['# Pedido', 'Comprador', 'Total', 'Estado', 'Comprobante', 'Fecha'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '0 12px 10px 0', fontWeight: 600, fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: 0.05 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {historial.map(c => (
                  <tr key={c.id} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '12px 12px 12px 0' }}>
                      <span className="mono tnum" style={{ fontWeight: 600 }}>{c.pedido?.numero ?? '—'}</span>
                    </td>
                    <td style={{ padding: '12px 12px 12px 0', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.pedido?.comprador_nombre ?? '—'}
                    </td>
                    <td style={{ padding: '12px 12px 12px 0' }}>
                      <span className="mono tnum" style={{ fontWeight: 600 }}>L {(c.pedido?.monto_total ?? 0).toLocaleString()}</span>
                    </td>
                    <td style={{ padding: '12px 12px 12px 0' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                        background: c.estado === 'verificado' ? '#ecfdf5' : '#fef2f2',
                        color: c.estado === 'verificado' ? '#065f46' : '#991b1b',
                      }}>
                        {c.estado === 'verificado' ? '✓ Aprobado' : '✕ Rechazado'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 12px 12px 0' }}>
                      {c.imagen_url ? (
                        <a href={c.imagen_url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--accent)', fontWeight: 600, fontSize: 12, textDecoration: 'none' }}>
                          <Icons.eye width={13} height={13}/> Ver
                        </a>
                      ) : <span style={{ color: 'var(--ink-3)' }}>—</span>}
                    </td>
                    <td style={{ padding: '12px 0', color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>
                      {fmt(c.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '20px 28px 0', flexShrink: 0 }}>
        <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.015em' }}>Comprobantes</div>
      </div>
      {tabBar}
      {comprobantes.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', color: 'var(--ink-3)' }}>
            <Icons.inbox width={32} height={32} style={{ margin: '0 auto 12px' }}/>
            <div style={{ fontSize: 14, fontWeight: 500 }}>Todo al día</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>No hay comprobantes esperando verificación</div>
          </div>
        </div>
      ) : (<>
      <div style={{ padding: '12px 28px 12px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexShrink: 0 }}>
        <div className="t-mute" style={{ fontSize: 13 }}>
          {comprobantes.length} pendientes · {pedido?.comprador_nombre} · {pedido?.numero}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline btn-sm" onClick={navAnterior} disabled={idx === 0}>
            <Icons.arrow width={13} height={13} style={{ transform: 'rotate(180deg)' }} />
            Anterior
          </button>
          <button className="btn btn-outline btn-sm" onClick={navSiguiente} disabled={idx === comprobantes.length - 1}>
            Siguiente
            <Icons.arrow width={13} height={13} />
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1.2fr 1fr', overflow: 'hidden' }}>
        {/* Imagen del comprobante */}
        <div style={{ background: '#2a2e35', padding: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto' }}>
          {current.imagen_url ? (
            <img
              src={current.imagen_url}
              alt="Comprobante"
              style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 8, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
            />
          ) : (
            <div style={{ width: 360, background: '#fff', borderRadius: 8, padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
              <div style={{ textAlign: 'center', paddingBottom: 16, borderBottom: '1px dashed #d4d4d4', marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.1, color: '#666' }}>{current.banco ?? 'BANCO'}</div>
                <div style={{ fontSize: 10, color: '#999', marginTop: 2 }}>Comprobante de transferencia</div>
              </div>
              <div style={{ display: 'grid', gap: 9, fontSize: 11 }}>
                {[
                  ['Fecha', fmt(current.fecha_transferencia ?? current.created_at)],
                  ['De', pedido?.comprador_nombre ?? '—'],
                  ['Cta destino', current.cuenta_destino ?? '—'],
                  ['Referencia', current.referencia ?? '—'],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#999' }}>{k}</span>
                    <span className="mono">{v}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 10, marginTop: 6, borderTop: '1px dashed #d4d4d4', fontSize: 14, fontWeight: 600 }}>
                  <span>Monto</span>
                  <span className="mono">L {(current.monto_declarado ?? 0).toLocaleString()}.00</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Detalles del pedido */}
        <div style={{ background: '#fff', padding: 24, overflowY: 'auto', borderLeft: '1px solid var(--line)' }}>
          <div style={{ marginBottom: 16 }}>
            <div className="mono t-mute" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.06 }}>Pedido</div>
            <div className="mono tnum" style={{ fontSize: 22, fontWeight: 600 }}>{pedido?.numero}</div>
          </div>

          {/* Prendas del pedido */}
          {(pedido?.pedido_items ?? []).length > 0 && (
            <div style={{ marginBottom: 16 }}>
              {(pedido?.pedido_items ?? []).map(item => (
                <div key={item.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
                  <div style={{ width: 48, height: 60, borderRadius: 6, overflow: 'hidden', flexShrink: 0, background: 'var(--surface-2)' }}>
                    {item.prenda?.fotos?.[0]
                      ? <img src={item.prenda.fotos[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <Ph tone="sand" aspect="4/5" radius={0} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.prenda?.nombre ?? '—'}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                      {[item.prenda?.marca, (item.talla_seleccionada ?? item.prenda?.talla) && `Talla ${item.talla_seleccionada ?? item.prenda?.talla}`].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <div className="mono tnum" style={{ fontSize: 14, fontWeight: 700, flexShrink: 0 }}>L {item.precio.toLocaleString()}</div>
                </div>
              ))}
            </div>
          )}

          {autoOk && (
            <div style={{ padding: '12px 14px', background: '#ecfdf5', borderRadius: 10, border: '1px solid #a7f3d0', marginBottom: 16, display: 'flex', gap: 10 }}>
              <Icons.check width={16} height={16} style={{ color: '#065f46', flexShrink: 0, marginTop: 1 }}/>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#065f46' }}>Verificación automática OK</div>
                <div style={{ fontSize: 12, color: '#047857', marginTop: 2 }}>Monto, cuenta destino y referencia coinciden.</div>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gap: 12 }}>
            <div>
              <div className="mono t-mute" style={{ fontSize: 10, textTransform: 'uppercase' }}>Comprador</div>
              <div style={{ fontSize: 14, fontWeight: 500, marginTop: 3 }}>{pedido?.comprador_nombre}</div>
              <div className="t-mute" style={{ fontSize: 12 }}>{pedido?.comprador_telefono}</div>
            </div>
            <hr className="hr"/>
            <div style={{ display: 'grid', gap: 6 }}>
              {[
                ['Esperado',    formatCurrency(pedido?.monto_total ?? 0), ''],
                ['Comprobante', current.monto_declarado != null ? `${formatCurrency(current.monto_declarado)}${current.coincide_monto ? ' ✓' : ''}` : '—', current.coincide_monto ? '#065f46' : ''],
                ['Cuenta',      current.cuenta_destino ? `${current.banco ?? ''} ${current.cuenta_destino}${current.coincide_cuenta ? ' ✓' : ''}` : '—', current.coincide_cuenta ? '#065f46' : ''],
                ['Referencia',  current.referencia ? `${current.referencia}${current.coincide_referencia ? ' ✓' : ''}` : '—', current.coincide_referencia ? '#065f46' : ''],
              ].map(([k, v, c]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span className="t-mute">{k}</span>
                  <span className="mono tnum" style={{ fontWeight: 500, color: c || 'inherit' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 20, display: 'grid', gap: 8 }}>
            {error && (
              <div style={{ padding: '10px 12px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: 12, lineHeight: 1.45 }}>
                {error}
              </div>
            )}
            {notice && (
              <div style={{ padding: '10px 12px', borderRadius: 8, background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', fontSize: 12, lineHeight: 1.45 }}>
                {notice}
              </div>
            )}

            {/* Ver comprobante */}
            {current.imagen_url && (
              <a
                href={current.imagen_url}
                target="_blank"
                rel="noreferrer"
                className="btn btn-outline btn-lg btn-block"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, textDecoration: 'none' }}
              >
                <Icons.eye width={15} height={15} /> Ver comprobante
              </a>
            )}

            {decided === 'ok' ? (
              <div style={{ padding: '14px 16px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                <Icons.check width={18} height={18} style={{ color: '#065f46', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#065f46' }}>Pago confirmado</div>
                  <div style={{ fontSize: 12, color: '#047857', marginTop: 2 }}>
                    {comprobantes.length > idx + 1 ? 'Pasando al siguiente...' : 'Todo al día por ahora.'}
                  </div>
                </div>
              </div>
            ) : decided === 'no' ? (
              <div style={{ padding: '14px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#991b1b' }}>Comprobante rechazado</div>
              </div>
            ) : (
              <>
                <button onClick={handleConfirmar} disabled={pending} className="btn btn-primary btn-lg btn-block" style={{ opacity: pending ? 0.7 : 1 }}>
                  <Icons.check width={16} height={16}/> {pending ? 'Procesando…' : 'Confirmar pago'}
                </button>
                <button onClick={handleRechazar} disabled={pending} className="btn btn-outline btn-lg btn-block" style={{ color: 'var(--urgent)', borderColor: '#fecaca', opacity: pending ? 0.5 : 1 }}>
                  {pending ? 'Procesando…' : 'Rechazar'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      </>)}
    </div>
  )
}
