'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icons } from '@/components/shared/icons';
import { createClient } from '@/lib/supabase/client';

interface PedidoItem {
  precio: number;
  talla_seleccionada: string | null;
  prendas: { nombre: string; marca: string | null } | null;
}

interface Pedido {
  id: string;
  comprador_nombre: string;
  comprador_email: string | null;
  monto_total: number;
  estado: string | null;
  created_at: string | null;
  pedido_items: PedidoItem[];
}

type Preset = 'mes' | 'anterior' | '30d' | '90d' | 'anio' | 'custom';

function getRange(preset: Preset, customDesde?: string, customHasta?: string): { desde: Date; hasta: Date; label: string } {
  const now = new Date();
  if (preset === 'mes') {
    const desde = new Date(now.getFullYear(), now.getMonth(), 1);
    return { desde, hasta: now, label: 'Este mes' };
  }
  if (preset === 'anterior') {
    const desde = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const hasta = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    const labels = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    return { desde, hasta, label: labels[desde.getMonth()] + ' ' + desde.getFullYear() };
  }
  if (preset === '30d') {
    const desde = new Date(now); desde.setDate(desde.getDate() - 29);
    return { desde, hasta: now, label: 'Últimos 30 días' };
  }
  if (preset === '90d') {
    const desde = new Date(now); desde.setDate(desde.getDate() - 89);
    return { desde, hasta: now, label: 'Últimos 90 días' };
  }
  if (preset === 'custom' && customDesde && customHasta) {
    const desde = new Date(customDesde + 'T00:00:00');
    const hasta = new Date(customHasta + 'T23:59:59');
    const fmt = (d: Date) => d.toLocaleDateString('es-HN', { day: 'numeric', month: 'short', year: 'numeric' });
    return { desde, hasta, label: `${fmt(desde)} – ${fmt(hasta)}` };
  }
  // anio
  const desde = new Date(now.getFullYear(), 0, 1);
  return { desde, hasta: now, label: String(now.getFullYear()) };
}

function fmtL(n: number) {
  return `L ${n.toLocaleString('es-HN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function dayKey(iso: string) {
  return iso.slice(0, 10);
}

interface DayPoint { date: string; label: string; total: number }
interface TopCliente { nombre: string; email: string | null; total: number; pedidos: number }
interface TopPrenda { nombre: string; talla: string; unidades: number; total: number }
interface TallaStats { talla: string; unidades: number; total: number }

function buildChartData(pedidos: Pedido[], desde: Date, hasta: Date): DayPoint[] {
  const map: Record<string, number> = {};
  pedidos.forEach(p => {
    if (!p.created_at) return;
    const k = dayKey(p.created_at);
    map[k] = (map[k] ?? 0) + p.monto_total;
  });

  const days: DayPoint[] = [];
  const cur = new Date(desde);
  cur.setHours(0, 0, 0, 0);
  const end = new Date(hasta);
  end.setHours(23, 59, 59, 999);

  const diffDays = Math.round((end.getTime() - cur.getTime()) / 86400000);
  const step = diffDays <= 31 ? 1 : diffDays <= 90 ? 7 : 30;

  while (cur <= end) {
    const k = cur.toISOString().slice(0, 10);
    let total = 0;
    if (step === 1) {
      total = map[k] ?? 0;
    } else {
      for (let i = 0; i < step; i++) {
        const d = new Date(cur); d.setDate(d.getDate() + i);
        total += map[d.toISOString().slice(0, 10)] ?? 0;
      }
    }
    const label = cur.toLocaleDateString('es-HN', step === 1 ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short' });
    days.push({ date: k, label, total });
    cur.setDate(cur.getDate() + step);
  }
  return days;
}

function buildTopClientes(pedidos: Pedido[]): TopCliente[] {
  const map: Record<string, TopCliente> = {};
  pedidos.forEach(p => {
    const key = p.comprador_nombre.toLowerCase().trim();
    if (!map[key]) map[key] = { nombre: p.comprador_nombre, email: p.comprador_email, total: 0, pedidos: 0 };
    map[key].total += p.monto_total;
    map[key].pedidos += 1;
  });
  return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 10);
}

function buildTopPrendas(pedidos: Pedido[]): TopPrenda[] {
  const map: Record<string, TopPrenda> = {};
  pedidos.forEach(p => {
    p.pedido_items.forEach(it => {
      const nombre = it.prendas ? [it.prendas.marca, it.prendas.nombre].filter(Boolean).join(' ') : 'Prenda';
      const talla = it.talla_seleccionada ?? '—';
      const key = `${nombre}||${talla}`;
      if (!map[key]) map[key] = { nombre, talla, unidades: 0, total: 0 };
      map[key].unidades += 1;
      map[key].total += it.precio;
    });
  });
  return Object.values(map).sort((a, b) => b.unidades - a.unidades).slice(0, 10);
}

function buildTallaStats(pedidos: Pedido[]): TallaStats[] {
  const map: Record<string, TallaStats> = {};
  pedidos.forEach(p => {
    p.pedido_items.forEach(it => {
      const t = it.talla_seleccionada ?? 'Sin talla';
      if (!map[t]) map[t] = { talla: t, unidades: 0, total: 0 };
      map[t].unidades += 1;
      map[t].total += it.precio;
    });
  });
  return Object.values(map).sort((a, b) => b.unidades - a.unidades);
}

function MiniBar({ value, max, color = 'var(--accent)' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ height: 4, borderRadius: 2, background: 'var(--line)', overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2, transition: 'width .3s' }} />
    </div>
  );
}

function BarChart({ data }: { data: DayPoint[] }) {
  const max = Math.max(...data.map(d => d.total), 1);
  const hasData = data.some(d => d.total > 0);
  const showLabels = data.length <= 31;

  if (!hasData) {
    return (
      <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
        Sin ventas en este período
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: data.length > 60 ? 1 : 3, height: 100, paddingBottom: showLabels ? 20 : 0, position: 'relative' }}>
      {data.map((d, i) => {
        const h = max > 0 ? Math.max((d.total / max) * 82, d.total > 0 ? 3 : 0) : 0;
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 0, position: 'relative', minWidth: 0 }} title={`${d.label}: ${fmtL(d.total)}`}>
            <div style={{ width: '100%', height: h, background: d.total > 0 ? 'var(--accent)' : 'var(--line)', borderRadius: '3px 3px 0 0', opacity: d.total > 0 ? 1 : 0.4, transition: 'height .3s' }} />
            {showLabels && i % Math.ceil(data.length / 8) === 0 && (
              <div style={{ position: 'absolute', bottom: -18, fontSize: 9, color: 'var(--ink-3)', whiteSpace: 'nowrap', transform: 'translateX(-50%)', left: '50%' }}>{d.label}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function AnaliticasClient() {
  const router = useRouter();
  const [preset, setPreset] = useState<Preset>('mes');
  const [customDesde, setCustomDesde] = useState('');
  const [customHasta, setCustomHasta] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const tiendaId = useRef<string | null>(null);

  async function cargar(p: Preset, cDesde?: string, cHasta?: string) {
    setLoading(true);
    const { desde, hasta } = getRange(p, cDesde, cHasta);
    const supabase = createClient();

    if (!tiendaId.current) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const uid = user.id as unknown as never;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: t } = await (supabase.from('tiendas').select('id').eq('user_id', uid).maybeSingle() as any);
      if (!t) { router.push('/onboarding'); return; }
      tiendaId.current = (t as { id: string }).id;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase
      .from('pedidos')
      .select(`
        id, comprador_nombre, comprador_email, monto_total, estado, created_at,
        pedido_items ( precio, talla_seleccionada, prendas ( nombre, marca ) )
      `) as any)
      .eq('tienda_id', tiendaId.current!)
      .not('estado', 'in', '(cancelado,apartado)')
      .gte('created_at', desde.toISOString())
      .lte('created_at', hasta.toISOString())
      .order('created_at', { ascending: true });

    setPedidos((data as unknown as Pedido[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { cargar('mes'); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handlePreset(p: Preset) {
    setPreset(p);
    if (p !== 'custom') { setShowCustom(false); cargar(p); }
    else setShowCustom(true);
  }

  function handleApplyCustom() {
    if (!customDesde || !customHasta) return;
    cargar('custom', customDesde, customHasta);
  }

  const { label, desde, hasta } = getRange(preset, customDesde || undefined, customHasta || undefined);

  const totalVentas = pedidos.reduce((s, p) => s + p.monto_total, 0);
  const totalPedidos = pedidos.length;
  const ticketPromedio = totalPedidos > 0 ? totalVentas / totalPedidos : 0;
  const totalItems = pedidos.reduce((s, p) => s + p.pedido_items.length, 0);

  const chartData = buildChartData(pedidos, desde, hasta);
  const topClientes = buildTopClientes(pedidos);
  const topPrendas = buildTopPrendas(pedidos);
  const tallaStats = buildTallaStats(pedidos);
  const maxCliente = topClientes[0]?.total ?? 1;
  const maxPrenda = topPrendas[0]?.unidades ?? 1;
  const maxTalla = tallaStats[0]?.unidades ?? 1;

  const PRESETS: { id: Preset; label: string }[] = [
    { id: 'mes', label: 'Este mes' },
    { id: 'anio', label: 'Este año' },
    { id: 'custom', label: 'Rango' },
  ];

  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '18px 28px 14px',
        borderBottom: '1px solid var(--line)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20,
        flexShrink: 0,
        background: 'rgba(255,255,255,0.68)',
        backdropFilter: 'blur(18px)',
        flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: '-0.025em' }}>Analíticas</div>
          <div className="t-mute" style={{ fontSize: 13, marginTop: 2 }}>{label}</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 4, background: 'var(--surface-2)', borderRadius: 10, padding: 3 }}>
            {PRESETS.map(pr => (
              <button
                key={pr.id}
                onClick={() => handlePreset(pr.id)}
                style={{
                  padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                  background: preset === pr.id ? '#fff' : 'transparent',
                  color: preset === pr.id ? 'var(--accent-3)' : 'var(--ink-3)',
                  boxShadow: preset === pr.id ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all .12s',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}
              >
                {pr.id === 'custom' && <Icons.filter width={11} height={11} />}
                {pr.label}
              </button>
            ))}
          </div>

          {/* Custom date range inputs */}
          {showCustom && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface-2)', borderRadius: 10, padding: '5px 10px', border: '1.5px solid rgba(201,100,66,0.25)' }}>
              <input
                type="date"
                value={customDesde}
                max={customHasta || todayStr}
                onChange={e => setCustomDesde(e.target.value)}
                style={{ fontSize: 12, background: 'transparent', border: 'none', outline: 'none', color: 'var(--ink)', fontFamily: 'inherit', cursor: 'pointer' }}
              />
              <span style={{ color: 'var(--ink-3)', fontSize: 11 }}>→</span>
              <input
                type="date"
                value={customHasta}
                min={customDesde || undefined}
                max={todayStr}
                onChange={e => setCustomHasta(e.target.value)}
                style={{ fontSize: 12, background: 'transparent', border: 'none', outline: 'none', color: 'var(--ink)', fontFamily: 'inherit', cursor: 'pointer' }}
              />
              <button
                onClick={handleApplyCustom}
                disabled={!customDesde || !customHasta}
                style={{
                  padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                  background: customDesde && customHasta ? 'var(--accent)' : 'var(--line)',
                  color: customDesde && customHasta ? '#fff' : 'var(--ink-3)',
                  transition: 'all .12s',
                }}
              >
                Aplicar
              </button>
            </div>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px 28px' }}>
        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Ingresos totales', value: loading ? '…' : fmtL(totalVentas), sub: 'pedidos cobrados', accent: true },
            { label: 'Pedidos', value: loading ? '…' : String(totalPedidos), sub: 'confirmados en el período', accent: false },
            { label: 'Ticket promedio', value: loading ? '…' : fmtL(ticketPromedio), sub: 'por pedido', accent: false },
            { label: 'Prendas vendidas', value: loading ? '…' : String(totalItems), sub: 'unidades en el período', accent: false },
          ].map(k => (
            <div key={k.label} className="card" style={{
              padding: '18px 20px',
              ...(k.accent ? {
                background: 'linear-gradient(135deg, #E78C61 0%, #C96442 100%)',
                border: 'none',
                boxShadow: '0 8px 24px rgba(201,100,66,0.22)',
              } : {}),
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.06, color: k.accent ? 'rgba(255,255,255,0.75)' : 'var(--ink-3)', marginBottom: 8 }}>
                {k.label}
              </div>
              <div className="tnum" style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.03em', color: k.accent ? '#fff' : 'var(--ink)' }}>
                {k.value}
              </div>
              <div style={{ fontSize: 11, marginTop: 4, color: k.accent ? 'rgba(255,255,255,0.7)' : 'var(--ink-3)' }}>{k.sub}</div>
            </div>
          ))}
        </div>

        {/* Ventas por día */}
        <div className="card" style={{ padding: '20px 22px', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 800 }}>Ventas por día</div>
            {!loading && totalVentas > 0 && (
              <div className="mono t-mute" style={{ fontSize: 12 }}>
                pico: {fmtL(Math.max(...chartData.map(d => d.total)))}
              </div>
            )}
          </div>
          {loading ? (
            <div style={{ height: 100, background: 'var(--surface-2)', borderRadius: 8, animation: 'pulse 1.5s infinite' }} />
          ) : (
            <BarChart data={chartData} />
          )}
        </div>

        {/* Bottom grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
          {/* Top clientes */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icons.user width={14} height={14} style={{ color: 'var(--accent)' }} />
              <div style={{ fontSize: 14, fontWeight: 800 }}>Mejores clientes</div>
            </div>
            {loading ? (
              <div style={{ padding: 28, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>Cargando...</div>
            ) : topClientes.length === 0 ? (
              <div style={{ padding: 28, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>Sin datos en este período</div>
            ) : topClientes.map((c, i) => (
              <div key={i} style={{ padding: '10px 18px', borderBottom: i < topClientes.length - 1 ? '1px solid var(--line-2)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: 11, flexShrink: 0,
                      background: i === 0 ? 'linear-gradient(135deg,var(--accent),var(--accent-3))' : 'var(--surface-2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9, fontWeight: 900, color: i === 0 ? '#fff' : 'var(--ink-3)',
                    }}>
                      {i + 1}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.nombre}</div>
                      {c.email && <div className="t-mute" style={{ fontSize: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.email}</div>}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
                    <div className="mono tnum" style={{ fontSize: 12, fontWeight: 700 }}>{fmtL(c.total)}</div>
                    <div className="t-mute" style={{ fontSize: 10 }}>{c.pedidos} pedido{c.pedidos !== 1 ? 's' : ''}</div>
                  </div>
                </div>
                <MiniBar value={c.total} max={maxCliente} />
              </div>
            ))}
          </div>

          {/* Tallas */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icons.grid width={14} height={14} style={{ color: 'var(--accent)' }} />
              <div style={{ fontSize: 14, fontWeight: 800 }}>Ventas por talla</div>
            </div>
            {loading ? (
              <div style={{ padding: 28, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>Cargando...</div>
            ) : tallaStats.length === 0 ? (
              <div style={{ padding: 28, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>Sin datos en este período</div>
            ) : tallaStats.map((t, i) => (
              <div key={i} style={{ padding: '10px 18px', borderBottom: i < tallaStats.length - 1 ? '1px solid var(--line-2)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      minWidth: 32, height: 22, borderRadius: 5, padding: '0 6px',
                      background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--ink-2)',
                    }}>
                      {t.talla}
                    </div>
                    <div className="t-mute" style={{ fontSize: 12 }}>{t.unidades} unidad{t.unidades !== 1 ? 'es' : ''}</div>
                  </div>
                  <div className="mono tnum" style={{ fontSize: 12, fontWeight: 700 }}>{fmtL(t.total)}</div>
                </div>
                <MiniBar value={t.unidades} max={maxTalla} color="#7B6B8F" />
              </div>
            ))}
          </div>
        </div>

        {/* Top prendas */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icons.sparkle width={14} height={14} style={{ color: 'var(--accent)' }} />
            <div style={{ fontSize: 14, fontWeight: 800 }}>Prendas más vendidas</div>
          </div>
          {loading ? (
            <div style={{ padding: 28, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>Cargando...</div>
          ) : topPrendas.length === 0 ? (
            <div style={{ padding: 28, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>Sin datos en este período</div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 80px 80px 80px 120px', padding: '9px 18px', borderBottom: '1px solid var(--line-2)', fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: 0.05 }} className="mono">
                <div>#</div><div>Prenda</div><div>Talla</div><div style={{ textAlign: 'right' }}>Und.</div><div style={{ textAlign: 'right' }}>Total</div><div style={{ paddingLeft: 8 }}>Popularidad</div>
              </div>
              {topPrendas.map((p, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '28px 1fr 80px 80px 80px 120px', padding: '10px 18px', borderBottom: i < topPrendas.length - 1 ? '1px solid var(--line-2)' : 'none', alignItems: 'center' }}>
                  <div className="mono t-mute" style={{ fontSize: 11 }}>{i + 1}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: 12 }}>{p.nombre}</div>
                  <div>
                    <span style={{ display: 'inline-block', padding: '2px 7px', borderRadius: 4, background: 'var(--surface-2)', fontSize: 10, fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
                      {p.talla}
                    </span>
                  </div>
                  <div className="mono tnum" style={{ fontSize: 12, fontWeight: 700, textAlign: 'right' }}>{p.unidades}</div>
                  <div className="mono tnum" style={{ fontSize: 12, fontWeight: 700, textAlign: 'right' }}>{fmtL(p.total)}</div>
                  <div style={{ paddingLeft: 8 }}>
                    <MiniBar value={p.unidades} max={maxPrenda} color="var(--accent)" />
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
