'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Icons } from '@/components/shared/icons'
import { Ph } from '@/components/shared/image-placeholder'
import { confirmarPago, rechazarPago } from './actions'
import { formatCurrencyTienda } from '@/lib/config/platform'

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

export default function ComprobantesClient({ comprobantes, historial, simbolo = 'L' }: { comprobantes: Comprobante[]; historial: Comprobante[]; simbolo?: string }) {
  const router = useRouter()
  const [tab, setTab] = useState<'pendientes' | 'historial'>('pendientes')
  const [idx, setIdx] = useState(0)
  const [decided, setDecided] = useState<{ id: string; status: 'ok' | 'no' } | null>(null)
  const [error, setError] = useState<{ id: string; message: string } | null>(null)
  const [notice, setNotice] = useState<{ id: string; message: string } | null>(null)
  const [pending, startTransition] = useTransition()

  const safeIdx = Math.min(idx, Math.max(0, comprobantes.length - 1))
  const current = comprobantes[safeIdx]
  const pedido = current?.pedido
  const currentDecision = current && decided?.id === current.id ? decided.status : null
  const currentError = current && error?.id === current.id ? error.message : null
  const currentNotice = current && notice?.id === current.id ? notice.message : null

  function handleConfirmar() {
    if (!current) return
    const target = current
    startTransition(async () => {
      setError(null)
      setNotice(null)
      const result = await confirmarPago(target.id, target.pedido_id)
      if ('error' in result) {
        setError({ id: target.id, message: result.error ?? 'No pudimos confirmar este comprobante.' })
        return
      }
      setDecided({ id: target.id, status: 'ok' })
      window.dispatchEvent(new Event('fd-dashboard-counts-refresh'))
      if (result.email?.status === 'sent') {
        setNotice({ id: target.id, message: 'Correo de confirmación enviado al comprador.' })
      } else if (result.email?.status === 'failed') {
        setError({ id: target.id, message: `No pudimos enviar el correo al comprador.` })
      }
      setTimeout(() => router.refresh(), 1500)
    })
  }

  function handleRechazar() {
    if (!current) return
    const target = current
    startTransition(async () => {
      setError(null)
      setNotice(null)
      const result = await rechazarPago(target.id, target.pedido_id)
      if ('error' in result) {
        setError({ id: target.id, message: result.error ?? 'No pudimos rechazar este comprobante.' })
        return
      }
      setDecided({ id: target.id, status: 'no' })
      window.dispatchEvent(new Event('fd-dashboard-counts-refresh'))
      setTimeout(() => router.refresh(), 1500)
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
    <div className="flex gap-1 px-7 border-b border-[var(--line)] shrink-0">
      {TABS.map(t => (
        <button
          key={t.id}
          onClick={() => setTab(t.id)}
          className={`px-[14px] pt-3 pb-[10px] text-[13px] flex items-center gap-[6px] bg-none leading-none border-b-2 ${tab === t.id ? 'font-bold text-[var(--accent-3)] border-[var(--accent)]' : 'font-medium text-[var(--ink-3)] border-transparent'}`}
        >
          {t.label}
          {t.count > 0 && (
            <span className={`min-w-[17px] h-[17px] rounded-[5px] px-1 text-[10px] font-bold flex items-center justify-center font-[var(--font-mono)] ${t.id === 'pendientes' ? 'bg-[var(--urgent)] text-white' : 'bg-[var(--line)] text-[var(--ink-3)]'}`}>
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )

  if (tab === 'historial') {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <div className="comprobantes-title-bar px-7 pt-5 shrink-0">
          <div className="text-[20px] font-semibold tracking-[-0.015em]">Comprobantes</div>
        </div>
        {tabBar}
        <div className="comprobantes-historial-content flex-1 overflow-y-auto overflow-x-hidden px-7 pb-7">
          {historial.length === 0 ? (
            <div className="pt-[60px] text-center text-[var(--ink-3)]">
              <Icons.inbox width={28} height={28} className="mx-auto mb-[10px] opacity-40"/>
              <div className="text-[13px]">Sin historial todavía</div>
            </div>
          ) : (
            <table className="comprobantes-historial-table w-full border-collapse mt-5 text-[13px]">
              <thead className="comprobantes-historial-head">
                <tr className="border-b border-[var(--line)]">
                  {['# Pedido', 'Comprador', 'Total', 'Estado', 'Comprobante', 'Fecha'].map(h => (
                    <th key={h} className="text-left pr-3 pb-[10px] font-semibold text-[11px] text-[var(--ink-3)] uppercase tracking-[0.05em]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {historial.map(c => (
                  <tr key={c.id} className="comprobantes-historial-row border-b border-[var(--line)]">
                    <td className="ch-numero py-3 pr-3">
                      <span className="mono tnum font-semibold">{c.pedido?.numero ?? '—'}</span>
                    </td>
                    <td className="ch-comprador py-3 pr-3 max-w-[160px] overflow-hidden text-ellipsis whitespace-nowrap">
                      {c.pedido?.comprador_nombre ?? '—'}
                    </td>
                    <td className="ch-total py-3 pr-3">
                      <span className="mono tnum font-semibold">{simbolo} {(c.pedido?.monto_total ?? 0).toLocaleString()}</span>
                    </td>
                    <td className="ch-estado py-3 pr-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-[3px] rounded-[6px] text-[11px] font-bold ${c.estado === 'verificado' ? 'bg-[#ecfdf5] text-[#065f46]' : 'bg-[#fef2f2] text-[#991b1b]'}`}>
                        {c.estado === 'verificado' ? 'Aprobado' : 'Rechazado'}
                      </span>
                    </td>
                    <td className="ch-imagen py-3 pr-3">
                      {c.imagen_url ? (
                        <a href={c.imagen_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-[5px] text-[var(--accent)] font-semibold text-[12px] no-underline">
                          <Icons.eye width={13} height={13}/> Ver
                        </a>
                      ) : <span className="text-[var(--ink-3)]">—</span>}
                    </td>
                    <td className="ch-fecha py-3 text-[var(--ink-3)] whitespace-nowrap">
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
    <div className="h-full flex flex-col overflow-hidden">
      <div className="comprobantes-title-bar px-7 pt-5 shrink-0">
        <div className="text-[20px] font-semibold tracking-[-0.015em]">Comprobantes</div>
      </div>
      {tabBar}
      {comprobantes.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-[var(--ink-3)]">
            <Icons.inbox width={32} height={32} className="mx-auto mb-3"/>
            <div className="text-[14px] font-medium">Todo al día</div>
            <div className="text-[12px] mt-1">No hay comprobantes esperando verificación</div>
          </div>
        </div>
      ) : (<>
      <div className="comprobantes-nav-bar px-7 py-3 border-b border-[var(--line)] flex items-center justify-between gap-5 shrink-0">
        <div className="t-mute text-[13px]">
          {comprobantes.length} pendientes · {pedido?.comprador_nombre} · {pedido?.numero}
        </div>
        <div className="flex gap-2">
          <button className="btn btn-outline btn-sm" onClick={navAnterior} disabled={safeIdx === 0}>
            <Icons.arrow width={13} height={13} className="rotate-180" />
            Anterior
          </button>
          <button className="btn btn-outline btn-sm" onClick={navSiguiente} disabled={safeIdx === comprobantes.length - 1}>
            Siguiente
            <Icons.arrow width={13} height={13} />
          </button>
        </div>
      </div>

      <div className="comprobantes-detail-grid flex-1 grid overflow-hidden grid-cols-[1.2fr_1fr]">
        {/* Imagen del comprobante */}
        <div className="bg-[#2a2e35] p-7 flex items-center justify-center overflow-auto">
          {current.imagen_url ? (
            <img
              src={current.imagen_url}
              alt="Comprobante"
              className="max-w-full max-h-full rounded-lg shadow-[0_20px_60px_rgba(0,0,0,0.3)]"
            />
          ) : (
            <div className="w-[360px] bg-white rounded-lg p-6 shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
              <div className="text-center pb-4 border-b border-dashed border-[#d4d4d4] mb-[14px]">
                <div className="text-[11px] font-semibold tracking-[0.1em] text-[#666]">{current.banco ?? 'BANCO'}</div>
                <div className="text-[10px] text-[#999] mt-[2px]">Comprobante de transferencia</div>
              </div>
              <div className="grid gap-[9px] text-[11px]">
                {[
                  ['Fecha', fmt(current.fecha_transferencia ?? current.created_at)],
                  ['De', pedido?.comprador_nombre ?? '—'],
                  ['Cta destino', current.cuenta_destino ?? '—'],
                  ['Referencia', current.referencia ?? '—'],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-[#999]">{k}</span>
                    <span className="mono">{v}</span>
                  </div>
                ))}
                <div className="flex justify-between pt-[10px] mt-[6px] border-t border-dashed border-[#d4d4d4] text-[14px] font-semibold">
                  <span>Monto</span>
                  <span className="mono">{simbolo} {(current.monto_declarado ?? 0).toLocaleString()}.00</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Detalles del pedido */}
        <div className="bg-white p-6 overflow-y-auto border-l border-[var(--line)]">
          <div className="mb-4">
            <div className="mono t-mute text-[11px] uppercase tracking-[0.06em]">Pedido</div>
            <div className="mono tnum text-[22px] font-semibold">{pedido?.numero}</div>
          </div>

          {/* Prendas del pedido */}
          {(pedido?.pedido_items ?? []).length > 0 && (
            <div className="mb-4">
              {(pedido?.pedido_items ?? []).map(item => (
                <div key={item.id} className="flex gap-3 items-center py-[10px] border-b border-[var(--line)]">
                  <div className="w-12 h-[60px] rounded-[6px] overflow-hidden shrink-0 bg-[var(--surface-2)]">
                    {item.prenda?.fotos?.[0]
                      ? <img loading="lazy" src={item.prenda.fotos[0]} alt="" className="w-full h-full object-cover" />
                      : <Ph tone="sand" aspect="4/5" radius={0} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold whitespace-nowrap overflow-hidden text-ellipsis">{item.prenda?.nombre ?? '—'}</div>
                    <div className="text-[11px] text-[var(--ink-3)]">
                      {[item.prenda?.marca, (item.talla_seleccionada ?? item.prenda?.talla) && `Talla ${item.talla_seleccionada ?? item.prenda?.talla}`].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <div className="mono tnum text-[14px] font-bold shrink-0">{simbolo} {item.precio.toLocaleString()}</div>
                </div>
              ))}
            </div>
          )}

          {autoOk && (
            <div className="px-[14px] py-3 bg-[#ecfdf5] rounded-[10px] border border-[#a7f3d0] mb-4 flex gap-[10px]">
              <Icons.check width={16} height={16} className="text-[#065f46] shrink-0 mt-[1px]"/>
              <div>
                <div className="text-[13px] font-medium text-[#065f46]">Verificación automática OK</div>
                <div className="text-[12px] text-[#047857] mt-[2px]">Monto, cuenta destino y referencia coinciden.</div>
              </div>
            </div>
          )}

          <div className="grid gap-3">
            <div>
              <div className="mono t-mute text-[10px] uppercase">Comprador</div>
              <div className="text-[14px] font-medium mt-[3px]">{pedido?.comprador_nombre}</div>
              <div className="t-mute text-[12px]">{pedido?.comprador_telefono}</div>
            </div>
            <hr className="hr"/>
            <div className="grid gap-[6px]">
              {[
                ['Esperado',    formatCurrencyTienda(pedido?.monto_total ?? 0, simbolo), ''],
                ['Comprobante', current.monto_declarado != null ? `${formatCurrencyTienda(current.monto_declarado, simbolo)}${current.coincide_monto ? ' ✓' : ''}` : '—', current.coincide_monto ? '#065f46' : ''],
                ['Cuenta',      current.cuenta_destino ? `${current.banco ?? ''} ${current.cuenta_destino}${current.coincide_cuenta ? ' ✓' : ''}` : '—', current.coincide_cuenta ? '#065f46' : ''],
                ['Referencia',  current.referencia ? `${current.referencia}${current.coincide_referencia ? ' ✓' : ''}` : '—', current.coincide_referencia ? '#065f46' : ''],
              ].map(([k, v, c]) => (
                <div key={k} className="flex justify-between text-[13px]">
                  <span className="t-mute">{k}</span>
                  <span className="mono tnum font-medium" style={{ color: c || 'inherit' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 grid gap-2">
            {currentError && (
              <div className="px-3 py-[10px] rounded-lg bg-[#fef2f2] border border-[#fecaca] text-[#991b1b] text-[12px] leading-[1.45]">
                {currentError}
              </div>
            )}
            {currentNotice && (
              <div className="px-3 py-[10px] rounded-lg bg-[#ecfdf5] border border-[#a7f3d0] text-[#065f46] text-[12px] leading-[1.45]">
                {currentNotice}
              </div>
            )}

            {/* Ver comprobante */}
            {current.imagen_url && (
              <a
                href={current.imagen_url}
                target="_blank"
                rel="noreferrer"
                className="btn btn-outline btn-lg btn-block flex items-center justify-center gap-[6px] no-underline"
              >
                <Icons.eye width={15} height={15} /> Ver comprobante
              </a>
            )}

            {currentDecision === 'ok' ? (
              <div className="px-4 py-[14px] bg-[#ecfdf5] border border-[#a7f3d0] rounded-[10px] flex items-center gap-[10px]">
                <Icons.check width={18} height={18} className="text-[#065f46] shrink-0" />
                <div>
                  <div className="text-[14px] font-semibold text-[#065f46]">Pago confirmado</div>
                  <div className="text-[12px] text-[#047857] mt-[2px]">
                    {comprobantes.length > safeIdx + 1 ? 'Actualizando pendientes...' : 'Todo al día por ahora.'}
                  </div>
                </div>
              </div>
            ) : currentDecision === 'no' ? (
              <div className="px-4 py-[14px] bg-[#fef2f2] border border-[#fecaca] rounded-[10px] flex items-center gap-[10px]">
                <div className="text-[14px] font-semibold text-[#991b1b]">Comprobante rechazado</div>
              </div>
            ) : (
              <>
                <button onClick={handleConfirmar} disabled={pending} className={`btn btn-primary btn-lg btn-block ${pending ? 'opacity-70' : ''}`}>
                  <Icons.check width={16} height={16}/> {pending ? 'Procesando…' : 'Confirmar pago'}
                </button>
                <button onClick={handleRechazar} disabled={pending} className={`btn btn-outline btn-lg btn-block text-[var(--urgent)] border-[#fecaca] ${pending ? 'opacity-50' : ''}`}>
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
