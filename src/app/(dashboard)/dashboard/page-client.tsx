'use client';

import { useRouter } from 'next/navigation';
import { CountdownTimer } from '@/components/drops/countdown-timer';
import { Icons } from '@/components/shared/icons';
import { Ph } from '@/components/shared/image-placeholder';
import { formatCurrencyTienda } from '@/lib/config/platform';
import { TONES } from '@/lib/ui/tones';

interface Drop {
  id: string;
  nombre: string;
  estado: string | null;
  inicia_at: string;
  cierra_at: string | null;
  vendidas_count: number | null;
  recaudado_total: number | null;
  foto_portada_url: string | null;
}

interface PedidoItem {
  id: string;
  precio: number;
  talla_seleccionada: string | null;
  prendas: { nombre: string; talla: string | null; marca: string | null } | null;
}

interface Pedido {
  id: string;
  numero: string;
  comprador_nombre: string;
  monto_total: number;
  metodo_pago: string | null;
  estado: string | null;
  created_at: string | null;
  pedido_items: PedidoItem[];
}

interface Stats {
  ventasMes: number;
  dropsActivos: number;
  inventarioActivo: number;
  comprobantesP: number;
}

function saludo(h: number) {
  if (h < 12) return 'Buenos días';
  if (h < 18) return 'Buenas tardes';
  return 'Buenas noches';
}

function fmt(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso);
  const m = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'][d.getMonth()];
  return `${d.getDate()} ${m} · ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function estadoBadge(e: string | null) {
  const labels: Record<string, string> = {
    apartado: 'Apartado', por_verificar: 'Por verificar', pagado: 'Pagado',
    empacado: 'Empacado', en_camino: 'Enviado', enviado: 'Enviado',
    entregado: 'Entregado', cancelado: 'Cancelado',
  };
  const cls = e === 'pagado' ? 'badge-ok' : e === 'apartado' || e === 'por_verificar' ? 'badge-held'
    : e === 'entregado' ? 'badge-sold' : e === 'cancelado' ? 'badge-danger' : '';
  return <span className={`badge ${cls}`}>{labels[e ?? ''] ?? e ?? '—'}</span>;
}

function StatCard({ label, value, help, icon: Icon, accent }: {
  label: string; value: string; help: string;
  icon: (p: React.SVGProps<SVGSVGElement> & { width?: number; height?: number }) => React.ReactNode;
  accent?: 'orange' | 'teal' | 'purple' | 'slate';
}) {
  const accentMap = {
    orange: { bg: 'linear-gradient(135deg, #E78C61 0%, #C96442 100%)', text: '#fff' },
    teal:   { bg: 'linear-gradient(135deg, #3E8F80 0%, #2D6A5D 100%)', text: '#fff' },
    purple: { bg: 'linear-gradient(135deg, #9A6D7C 0%, #7B4F63 100%)', text: '#fff' },
    slate:  { bg: 'linear-gradient(135deg, #66554E 0%, #3F312B 100%)', text: '#fff' },
  };
  const a = accent ? accentMap[accent] : null;
  if (a) return (
    <div className="rounded-[var(--radius-lg)] px-[22px] py-5 text-white shadow-[0_8px_24px_rgba(26,20,16,0.12)] relative overflow-hidden" style={{ background: a.bg }}>
      <div className="absolute right-[-10px] bottom-[-10px] opacity-10 text-[80px] font-black font-[var(--font-mono)]">L</div>
      <div className="text-[11px] font-bold uppercase tracking-[0.08em] opacity-75 mb-[10px]">{label}</div>
      <div className="tnum text-[28px] font-black tracking-[-0.03em] leading-none">{value}</div>
      <div className="text-[11px] font-semibold mt-2 opacity-85">{help}</div>
    </div>
  );
  return (
    <div className="card px-5 py-[18px]">
      <div className="flex justify-between items-center gap-3">
        <div className="mono t-mute text-[11px] uppercase tracking-[0.06em]">{label}</div>
        <div className="w-[30px] h-[30px] rounded-lg bg-[var(--surface-2)] flex items-center justify-center">
          <Icon width={14} height={14}/>
        </div>
      </div>
      <div className="tnum text-[27px] font-extrabold mt-2 tracking-[-0.025em]">{value}</div>
      <div className="t-mute text-[12px] mt-[3px]">{help}</div>
    </div>
  );
}

export default function DashboardPageClient({
  tiendaUsername,
  tiendaNombre,
  drops,
  pedidos,
  stats,
  simbolo = 'L',
}: {
  tiendaUsername: string;
  tiendaNombre: string;
  drops: Drop[];
  pedidos: Pedido[];
  stats: Stats;
  simbolo?: string;
}) {
  const router = useRouter();
  const now = new Date();
  const greeting = saludo(now.getHours());
  const primerNombre = tiendaNombre.split(' ')[0];
  const fechaLabel = now.toLocaleDateString('es-HN', { weekday: 'long', day: 'numeric', month: 'long' });
  const dropActivo = drops.find(d => d.estado === 'activo') ?? null;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Live drop banner */}
      {dropActivo && (
        <div className="dash-live-bar bg-[linear-gradient(135deg,#4A332A_0%,#2F211A_52%,#241711_100%)] px-7 py-4 flex items-center gap-4 shrink-0 relative overflow-hidden">
          <div className="absolute inset-0 opacity-[0.06] pointer-events-none bg-[linear-gradient(rgba(255,255,255,.4)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.4)_1px,transparent_1px)] bg-[size:40px_40px]"/>
          <div className="relative z-[1] flex items-center gap-[10px] flex-1 min-w-0">
            <div className="flex items-center gap-[6px]">
              <span className="w-2 h-2 rounded-full bg-[var(--urgent)] animate-pulse block"/>
              <span className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-[rgba(255,200,180,0.9)]">En vivo ahora</span>
            </div>
            <span className="w-px h-[14px] bg-[rgba(255,255,255,0.15)] block"/>
            <div className="text-[#f5f2ee] text-[14px] font-semibold overflow-hidden text-ellipsis whitespace-nowrap">{dropActivo.nombre}</div>
            <div className="dash-live-bar-stats flex gap-[6px] ml-1">
              {[
                { l: 'Vendidas', v: String(dropActivo.vendidas_count ?? 0), c: '#86efac' },
                { l: 'Recaudado', v: formatCurrencyTienda(dropActivo.recaudado_total ?? 0, simbolo), c: '#fbbf24' },
              ].map(s => (
                <div key={s.l} className="flex items-center gap-[5px] px-[10px] py-1 rounded-[7px] bg-[rgba(255,255,255,0.07)] border border-[rgba(255,255,255,0.1)]">
                  <span className="text-[10px] text-[rgba(255,255,255,0.5)] uppercase tracking-[0.06em]">{s.l}</span>
                  <span className="mono tnum text-[12px] font-bold" style={{ color: s.c }}>{s.v}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="dash-live-bar-right relative z-[1] flex items-center gap-[10px] shrink-0">
            <div className="text-right min-w-0">
              <div className="text-[10px] text-[rgba(255,255,255,0.4)] uppercase tracking-[0.1em] mb-[2px]">Cierra en</div>
              <CountdownTimer target={dropActivo.cierra_at ? new Date(dropActivo.cierra_at).getTime() : new Date(dropActivo.inicia_at).getTime() + 3600000} size="sm" color="#f5f2ee"/>
            </div>
            <button onClick={() => router.push(`/drops/${dropActivo.id}`)} className="btn btn-accent btn-sm font-bold shrink-0">
              Ver drop <Icons.arrow width={13} height={13}/>
            </button>
          </div>
        </div>
      )}

      <div className="dash-page-header px-7 pt-[18px] pb-[14px] border-b border-[var(--line)] flex items-end justify-between gap-5 shrink-0 bg-[rgba(255,255,255,0.68)] backdrop-blur-[18px]">
        <div>
          <div className="text-[20px] font-black tracking-[-0.025em]">{greeting}, {primerNombre}</div>
          <div className="t-mute text-[13px] mt-[2px]">
            {fechaLabel} · {stats.comprobantesP > 0 ? `${stats.comprobantesP} comprobantes esperando` : 'Sin pendientes'}
          </div>
        </div>
        <div className="dash-page-header-actions flex gap-2">
          <button onClick={() => router.push(`/${tiendaUsername}`)} className="btn btn-outline btn-sm">
            <Icons.eye width={13} height={13}/> Vista compradora
          </button>
          <button onClick={() => router.push('/drops/nuevo')} className="btn btn-accent btn-sm">
            <Icons.plus width={13} height={13}/> Nuevo drop
          </button>
        </div>
      </div>

      <div className="dash-page-content flex-1 overflow-y-auto px-7 pt-5 pb-7 bg-[radial-gradient(circle_at_top_right,rgba(201,100,66,0.06)_0%,transparent_20%),linear-gradient(180deg,rgba(255,255,255,0.18)_0%,transparent_100%)]">
        <div className="dash-stats-grid grid gap-[14px] mb-6" style={{ gridTemplateColumns: 'repeat(4, minmax(160px, 1fr))' }}>
          <StatCard label="Ventas del mes" value={formatCurrencyTienda(stats.ventasMes, simbolo)} help="Este mes · pedidos pagados" icon={Icons.wallet} accent="orange"/>
          <StatCard label="Drops activos" value={String(stats.dropsActivos)} help="Lanzamientos en vivo" icon={Icons.sparkle}/>
          <StatCard label="Comprobantes" value={String(stats.comprobantesP)} help="Pagos por verificar" icon={Icons.inbox}/>
          <StatCard label="Inventario activo" value={String(stats.inventarioActivo)} help="Unidades disponibles" icon={Icons.grid}/>
        </div>

        <div className="dash-content-grid grid gap-5 items-start" style={{ gridTemplateColumns: '1.35fr 1fr' }}>
          <section>
            <div className="flex items-center justify-between mb-[10px]">
              <div className="text-[15px] font-bold">Drops recientes</div>
              <button onClick={() => router.push('/drops')} className="btn btn-outline btn-sm">Gestionar drops <Icons.arrow width={13} height={13}/></button>
            </div>
            <div className="card overflow-hidden max-h-[240px] overflow-y-auto">
              {drops.length === 0 ? (
                <div className="p-9 text-center">
                  <div className="text-[14px] font-semibold mb-[6px]">No tienes drops aún</div>
                  <div className="t-mute text-[13px] mb-4">Crea tu primer lanzamiento para empezar a vender.</div>
                  <button onClick={() => router.push('/drops/nuevo')} className="btn btn-primary btn-sm"><Icons.plus width={13} height={13}/> Crear drop</button>
                </div>
              ) : drops.map((d, i) => {
                const target = d.estado === 'activo' && d.cierra_at ? new Date(d.cierra_at).getTime() : new Date(d.inicia_at).getTime();
                const fechaRef = d.estado === 'cerrado' ? d.cierra_at : d.inicia_at;
                const fecha = fechaRef ? new Date(fechaRef) : null;
                const fmtFecha = fecha ? `${fecha.getDate()} ${['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'][fecha.getMonth()]}` : '';
                const isLive = d.estado === 'activo';
                return (
                  <div key={d.id} onClick={() => router.push(`/drops/${d.id}`)}
                    className={`px-4 py-3 flex items-center gap-3 cursor-pointer transition-[background] duration-[120ms] ${i < drops.length - 1 ? 'border-b border-[var(--line)]' : ''}`}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                  >
                    <div className="w-12 h-12 rounded-[10px] overflow-hidden bg-[var(--surface-2)] shrink-0 relative">
                      {d.foto_portada_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img loading="lazy" src={d.foto_portada_url} alt="" className="w-full h-full object-cover block"/>
                      ) : <Ph tone={TONES[i % TONES.length]} radius={10}/>}
                      {isLive && <div className="absolute bottom-[3px] right-[3px] w-2 h-2 rounded-full bg-[#ef4444] border-[1.5px] border-white animate-pulse"/>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-[6px] mb-[3px]">
                        <div className="text-[13px] font-bold whitespace-nowrap overflow-hidden text-ellipsis">{d.nombre}</div>
                        {isLive ? <span className="badge badge-live shrink-0"><span className="dot"/>En vivo</span>
                          : d.estado === 'programado' ? <span className="badge shrink-0 text-[#2563eb] border-[#bfdbfe] bg-[#eff6ff]">Programado</span>
                          : <span className="badge shrink-0 text-[#6b7280] border-[#e5e7eb] bg-[#f9fafb]">Cerrado</span>}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="t-mute text-[11px]">{fmtFecha} · {d.vendidas_count ?? 0} vendidas</span>
                        {isLive || d.estado === 'programado' ? (
                          <span className={`mono tnum text-[11px] ${isLive ? 'text-[var(--urgent)]' : 'text-[var(--ink-3)]'}`}><CountdownTimer target={target} size="sm"/></span>
                        ) : (
                          <span className={`tnum text-[12px] font-bold ${(d.recaudado_total ?? 0) > 0 ? 'text-[var(--ink)]' : 'text-[var(--ink-3)]'}`}>{formatCurrencyTienda(d.recaudado_total ?? 0, simbolo)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section>
            <div className="text-[14px] font-extrabold mb-[10px] tracking-[-0.01em]">Comprobantes por verificar</div>
            <button
              onClick={() => router.push('/comprobantes')}
              className={`w-full px-[18px] py-4 flex items-center gap-3 text-left rounded-[var(--radius-lg)] cursor-pointer ${stats.comprobantesP > 0 ? 'bg-[linear-gradient(135deg,#FFF1EC_0%,#FFE8DF_100%)] border-[1.5px] border-[rgba(201,100,66,0.3)]' : 'bg-[var(--surface)] border border-[var(--line)]'}`}
            >
              <div className={`w-[38px] h-[38px] rounded-[10px] flex items-center justify-center shrink-0 ${stats.comprobantesP > 0 ? 'bg-[var(--accent)]' : 'bg-[var(--surface-2)]'}`}>
                <Icons.inbox width={16} height={16} className={stats.comprobantesP > 0 ? 'text-white' : 'text-[var(--ink-3)]'}/>
              </div>
              <div className="flex-1">
                <div className={`text-[13px] font-extrabold ${stats.comprobantesP > 0 ? 'text-[var(--accent-3)]' : 'text-[var(--ink)]'}`}>
                  {stats.comprobantesP > 0 ? `${stats.comprobantesP} comprobantes sin verificar` : 'Sin comprobantes pendientes'}
                </div>
                <div className={`text-[11px] mt-[2px] ${stats.comprobantesP > 0 ? 'text-[var(--accent)]' : 'text-[var(--ink-3)]'}`}>
                  {stats.comprobantesP > 0 ? 'Toca para revisar y confirmar pagos' : 'Todo al día por ahora.'}
                </div>
              </div>
              <Icons.arrow width={14} height={14} className={`shrink-0 ${stats.comprobantesP > 0 ? 'text-[var(--accent)]' : 'text-[var(--ink-3)]'}`}/>
            </button>
          </section>
        </div>

        <section className="mt-6">
          <div className="flex items-center justify-between mb-[10px]">
            <div className="text-[15px] font-bold">Últimas ventas</div>
            <button onClick={() => router.push('/pedidos')} className="btn btn-outline btn-sm">Ver pedidos <Icons.arrow width={13} height={13}/></button>
          </div>
          <div className="card overflow-hidden">
            <div className="max-h-[360px] overflow-y-auto overflow-x-auto [-webkit-overflow-scrolling:touch]">
              <div className="dash-ventas-table-wrapper min-w-[700px]">
                <div className="dash-ventas-header mono grid px-4 py-[10px] border-b border-[var(--line)] text-[11px] text-[var(--ink-3)] uppercase sticky top-0 bg-white z-[1]" style={{ gridTemplateColumns: '100px 1fr minmax(220px, 1.6fr) 80px 110px 120px 120px' }}>
                  <div>Pedido</div><div>Comprador</div><div>Prenda</div><div>Talla</div><div>Monto</div><div>Fecha</div><div>Estado</div>
                </div>
                {pedidos.length === 0 ? (
                  <div className="p-[34px] text-center text-[var(--ink-3)] text-[13px]">No hay ventas recientes</div>
                ) : pedidos.map((p, i) => {
                  const item = p.pedido_items?.[0];
                  const prenda = item?.prendas;
                  const talla = item?.talla_seleccionada ?? prenda?.talla;
                  const prendaLabel = prenda ? [prenda.marca, prenda.nombre].filter(Boolean).join(' · ') : '—';
                  return (
                    <div key={p.id} className={`dash-ventas-row grid px-4 py-3 items-center text-[12px] ${i < pedidos.length - 1 ? 'border-b border-[var(--line-2)]' : ''}`} style={{ gridTemplateColumns: '100px 1fr minmax(220px, 1.6fr) 80px 110px 120px 120px' }}>
                      <div className="ventas-c-num mono tnum font-bold">{p.numero}</div>
                      <div className="ventas-c-buyer whitespace-nowrap overflow-hidden text-ellipsis pr-3">{p.comprador_nombre}</div>
                      <div className="ventas-c-item t-mute whitespace-nowrap overflow-hidden text-ellipsis">{prendaLabel}</div>
                      <div className="ventas-c-size mono tnum font-bold">{talla ?? '—'}</div>
                      <div className="ventas-c-amount mono tnum font-bold">{simbolo} {p.monto_total.toLocaleString()}</div>
                      <div className="ventas-c-date t-mute">{fmt(p.created_at)}</div>
                      <div className="ventas-c-status">{estadoBadge(p.estado)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
