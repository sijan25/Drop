'use client';

import { useRouter } from 'next/navigation';
import { CountdownTimer } from '@/components/drops/countdown-timer';
import { Icons } from '@/components/shared/icons';
import { Ph } from '@/components/shared/image-placeholder';
import { formatCurrency } from '@/lib/config/platform';
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
    <div style={{ padding: '20px 22px', borderRadius: 'var(--radius-lg)', background: a.bg, color: a.text, boxShadow: '0 8px 24px rgba(26,20,16,0.12)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', right: -10, bottom: -10, opacity: 0.1, fontSize: 80, fontWeight: 900, fontFamily: 'var(--font-mono)' }}>L</div>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.08, opacity: 0.75, marginBottom: 10 }}>{label}</div>
      <div className="tnum" style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 600, marginTop: 8, opacity: 0.85 }}>{help}</div>
    </div>
  );
  return (
    <div className="card" style={{ padding: '18px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div className="mono t-mute" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.06 }}>{label}</div>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon width={14} height={14}/>
        </div>
      </div>
      <div className="tnum" style={{ fontSize: 27, fontWeight: 800, marginTop: 8, letterSpacing: '-0.025em' }}>{value}</div>
      <div className="t-mute" style={{ fontSize: 12, marginTop: 3 }}>{help}</div>
    </div>
  );
}

export default function DashboardPageClient({
  tiendaUsername,
  tiendaNombre,
  drops,
  pedidos,
  stats,
}: {
  tiendaUsername: string;
  tiendaNombre: string;
  drops: Drop[];
  pedidos: Pedido[];
  stats: Stats;
}) {
  const router = useRouter();
  const now = new Date();
  const greeting = saludo(now.getHours());
  const primerNombre = tiendaNombre.split(' ')[0];
  const fechaLabel = now.toLocaleDateString('es-HN', { weekday: 'long', day: 'numeric', month: 'long' });
  const dropActivo = drops.find(d => d.estado === 'activo') ?? null;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Live drop banner */}
      {dropActivo && (
        <div className="dash-live-bar" style={{
          background: 'linear-gradient(135deg, #4A332A 0%, #2F211A 52%, #241711 100%)',
          padding: '16px 28px', display: 'flex', alignItems: 'center', gap: 16,
          flexShrink: 0, position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', inset: 0, opacity: 0.06, pointerEvents: 'none', backgroundImage: 'linear-gradient(rgba(255,255,255,.4) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.4) 1px,transparent 1px)', backgroundSize: '40px 40px' }}/>
          <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 4, background: 'var(--urgent)', animation: 'pulse 1.4s infinite', display: 'block' }}/>
              <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.1, color: 'rgba(255,200,180,0.9)' }}>En vivo ahora</span>
            </div>
            <span style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.15)', display: 'block' }}/>
            <div style={{ color: '#f5f2ee', fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dropActivo.nombre}</div>
            <div className="dash-live-bar-stats" style={{ display: 'flex', gap: 6, marginLeft: 4 }}>
              {[
                { l: 'Vendidas', v: String(dropActivo.vendidas_count ?? 0), c: '#86efac' },
                { l: 'Recaudado', v: formatCurrency(dropActivo.recaudado_total ?? 0), c: '#fbbf24' },
              ].map(s => (
                <div key={s.l} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 7, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.06 }}>{s.l}</span>
                  <span className="mono tnum" style={{ fontSize: 12, fontWeight: 700, color: s.c }}>{s.v}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="dash-live-bar-right" style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <div style={{ textAlign: 'right', minWidth: 0 }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.1, marginBottom: 2 }}>Cierra en</div>
              <CountdownTimer target={dropActivo.cierra_at ? new Date(dropActivo.cierra_at).getTime() : new Date(dropActivo.inicia_at).getTime() + 3600000} size="sm" color="#f5f2ee"/>
            </div>
            <button onClick={() => router.push(`/drops/${dropActivo.id}`)} className="btn btn-accent btn-sm" style={{ fontWeight: 700, flexShrink: 0 }}>
              Ver drop <Icons.arrow width={13} height={13}/>
            </button>
          </div>
        </div>
      )}

      <div className="dash-page-header" style={{ padding: '18px 28px 14px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexShrink: 0, background: 'rgba(255,255,255,0.68)', backdropFilter: 'blur(18px)' }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: '-0.025em' }}>{greeting}, {primerNombre}</div>
          <div className="t-mute" style={{ fontSize: 13, marginTop: 2 }}>
            {fechaLabel} · {stats.comprobantesP > 0 ? `${stats.comprobantesP} comprobantes esperando` : 'Sin pendientes'}
          </div>
        </div>
        <div className="dash-page-header-actions" style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => router.push(`/${tiendaUsername}`)} className="btn btn-outline btn-sm">
            <Icons.eye width={13} height={13}/> Vista compradora
          </button>
          <button onClick={() => router.push('/drops/nuevo')} className="btn btn-accent btn-sm">
            <Icons.plus width={13} height={13}/> Nuevo drop
          </button>
        </div>
      </div>

      <div className="dash-page-content" style={{ flex: 1, overflowY: 'auto', padding: '20px 28px 28px', background: 'radial-gradient(circle at top right, rgba(201,100,66,0.06) 0%, transparent 20%), linear-gradient(180deg, rgba(255,255,255,0.18) 0%, transparent 100%)' }}>
        <div className="dash-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(160px, 1fr))', gap: 14, marginBottom: 24 }}>
          <StatCard label="Ventas del mes" value={formatCurrency(stats.ventasMes)} help="Este mes · pedidos pagados" icon={Icons.wallet} accent="orange"/>
          <StatCard label="Drops activos" value={String(stats.dropsActivos)} help="Lanzamientos en vivo" icon={Icons.sparkle}/>
          <StatCard label="Comprobantes" value={String(stats.comprobantesP)} help="Pagos por verificar" icon={Icons.inbox}/>
          <StatCard label="Inventario activo" value={String(stats.inventarioActivo)} help="Unidades disponibles" icon={Icons.grid}/>
        </div>

        <div className="dash-content-grid" style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr', gap: 20, alignItems: 'start' }}>
          <section>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Drops recientes</div>
              <button onClick={() => router.push('/drops')} className="btn btn-outline btn-sm">Gestionar drops <Icons.arrow width={13} height={13}/></button>
            </div>
            <div className="card" style={{ overflow: 'hidden' }}>
              {drops.length === 0 ? (
                <div style={{ padding: 36, textAlign: 'center' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>No tienes drops aún</div>
                  <div className="t-mute" style={{ fontSize: 13, marginBottom: 16 }}>Crea tu primer lanzamiento para empezar a vender.</div>
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
                    style={{ padding: '12px 16px', borderBottom: i < drops.length - 1 ? '1px solid var(--line)' : 'none', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', transition: 'background .12s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                  >
                    <div style={{ width: 48, height: 48, borderRadius: 10, overflow: 'hidden', background: 'var(--surface-2)', flexShrink: 0, position: 'relative' }}>
                      {d.foto_portada_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img loading="lazy" src={d.foto_portada_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}/>
                      ) : <Ph tone={TONES[i % TONES.length]} radius={10}/>}
                      {isLive && <div style={{ position: 'absolute', bottom: 3, right: 3, width: 8, height: 8, borderRadius: 4, background: '#ef4444', border: '1.5px solid #fff', animation: 'pulse 1.4s ease-in-out infinite' }}/>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 3 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.nombre}</div>
                        {isLive ? <span className="badge badge-live" style={{ flexShrink: 0 }}><span className="dot"/>En vivo</span>
                          : d.estado === 'programado' ? <span className="badge" style={{ flexShrink: 0, color: '#2563eb', borderColor: '#bfdbfe', background: '#eff6ff' }}>Programado</span>
                          : <span className="badge" style={{ flexShrink: 0, color: '#6b7280', borderColor: '#e5e7eb', background: '#f9fafb' }}>Cerrado</span>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span className="t-mute" style={{ fontSize: 11 }}>{fmtFecha} · {d.vendidas_count ?? 0} vendidas</span>
                        {isLive || d.estado === 'programado' ? (
                          <span className="mono tnum" style={{ fontSize: 11, color: isLive ? 'var(--urgent)' : 'var(--ink-3)' }}><CountdownTimer target={target} size="sm"/></span>
                        ) : (
                          <span className="tnum" style={{ fontSize: 12, fontWeight: 700, color: (d.recaudado_total ?? 0) > 0 ? 'var(--ink)' : 'var(--ink-3)' }}>{formatCurrency(d.recaudado_total ?? 0)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section>
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10, letterSpacing: '-0.01em' }}>Comprobantes por verificar</div>
            <button onClick={() => router.push('/comprobantes')} style={{
              width: '100%', padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
              borderRadius: 'var(--radius-lg)', cursor: 'pointer',
              background: stats.comprobantesP > 0 ? 'linear-gradient(135deg, #FFF1EC 0%, #FFE8DF 100%)' : 'var(--surface)',
              border: stats.comprobantesP > 0 ? '1.5px solid rgba(201,100,66,0.3)' : '1px solid var(--line)',
            }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: stats.comprobantesP > 0 ? 'var(--accent)' : 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icons.inbox width={16} height={16} style={{ color: stats.comprobantesP > 0 ? '#fff' : 'var(--ink-3)' }}/>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: stats.comprobantesP > 0 ? 'var(--accent-3)' : 'var(--ink)' }}>
                  {stats.comprobantesP > 0 ? `${stats.comprobantesP} comprobantes sin verificar` : 'Sin comprobantes pendientes'}
                </div>
                <div style={{ fontSize: 11, marginTop: 2, color: stats.comprobantesP > 0 ? 'var(--accent)' : 'var(--ink-3)' }}>
                  {stats.comprobantesP > 0 ? 'Toca para revisar y confirmar pagos' : 'Todo al día por ahora.'}
                </div>
              </div>
              <Icons.arrow width={14} height={14} style={{ color: stats.comprobantesP > 0 ? 'var(--accent)' : 'var(--ink-3)', flexShrink: 0 }}/>
            </button>
          </section>
        </div>

        <section style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Últimas ventas</div>
            <button onClick={() => router.push('/pedidos')} className="btn btn-outline btn-sm">Ver pedidos <Icons.arrow width={13} height={13}/></button>
          </div>
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ maxHeight: 360, overflowY: 'auto', overflowX: 'auto', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
              <div className="dash-ventas-table-wrapper" style={{ minWidth: 700 }}>
                <div className="dash-ventas-header mono" style={{ display: 'grid', gridTemplateColumns: '100px 1fr minmax(220px, 1.6fr) 80px 110px 120px 120px', padding: '10px 16px', borderBottom: '1px solid var(--line)', fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
                  <div>Pedido</div><div>Comprador</div><div>Prenda</div><div>Talla</div><div>Monto</div><div>Fecha</div><div>Estado</div>
                </div>
                {pedidos.length === 0 ? (
                  <div style={{ padding: 34, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>No hay ventas recientes</div>
                ) : pedidos.map((p, i) => {
                  const item = p.pedido_items?.[0];
                  const prenda = item?.prendas;
                  const talla = item?.talla_seleccionada ?? prenda?.talla;
                  const prendaLabel = prenda ? [prenda.marca, prenda.nombre].filter(Boolean).join(' · ') : '—';
                  return (
                    <div key={p.id} className="dash-ventas-row" style={{ display: 'grid', gridTemplateColumns: '100px 1fr minmax(220px, 1.6fr) 80px 110px 120px 120px', padding: '12px 16px', borderBottom: i < pedidos.length - 1 ? '1px solid var(--line-2)' : 'none', alignItems: 'center', fontSize: 12 }}>
                      <div className="ventas-c-num mono tnum" style={{ fontWeight: 700 }}>{p.numero}</div>
                      <div className="ventas-c-buyer" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: 12 }}>{p.comprador_nombre}</div>
                      <div className="ventas-c-item t-mute" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{prendaLabel}</div>
                      <div className="ventas-c-size mono tnum" style={{ fontWeight: 700 }}>{talla ?? '—'}</div>
                      <div className="ventas-c-amount mono tnum" style={{ fontWeight: 700 }}>L {p.monto_total.toLocaleString()}</div>
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
