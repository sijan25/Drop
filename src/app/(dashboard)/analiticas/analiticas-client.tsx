'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icons } from '@/components/shared/icons';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/config/platform';

interface PedidoItem {
  precio: number;
  talla_seleccionada: string | null;
  prendas: { nombre: string; marca: string | null } | null;
}

interface Pedido {
  id: string;
  numero: string;
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
  return formatCurrency(n);
}

function fmtFecha(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('es-HN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function dayKey(iso: string) {
  return iso.slice(0, 10);
}

interface DayPoint { date: string; label: string; total: number; desde: string; hasta: string }
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
    const bucketEnd = new Date(cur);
    bucketEnd.setDate(bucketEnd.getDate() + step - 1);
    if (bucketEnd > end) bucketEnd.setTime(end.getTime());
    const label = cur.toLocaleDateString('es-HN', step === 1 ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short' });
    days.push({ date: k, label, total, desde: k, hasta: bucketEnd.toISOString().slice(0, 10) });
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
    <div className="h-1 rounded-sm bg-[var(--line)] overflow-hidden">
      <div className="h-full rounded-sm transition-[width] duration-300" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

function BarChart({ data, selectedDate, onSelect }: { data: DayPoint[]; selectedDate: string | null; onSelect: (date: string) => void }) {
  const max = Math.max(...data.map(d => d.total), 1);
  const hasData = data.some(d => d.total > 0);
  const showLabels = data.length <= 31;

  if (!hasData) {
    return (
      <div className="h-[120px] flex items-center justify-center text-[var(--ink-3)] text-[13px]">
        Sin ventas en este período
      </div>
    );
  }

  return (
    <div className="relative flex items-end h-[100px]" style={{ gap: data.length > 60 ? 1 : 3, paddingBottom: showLabels ? 20 : 0 }}>
      {data.map((d, i) => {
        const h = max > 0 ? Math.max((d.total / max) * 82, d.total > 0 ? 3 : 0) : 0;
        const selected = selectedDate === d.date;
        return (
          <button
            key={i}
            type="button"
            onClick={() => d.total > 0 && onSelect(d.date)}
            className="flex-1 flex flex-col items-center justify-end relative min-w-0 h-full p-0 bg-transparent"
            style={{ cursor: d.total > 0 ? 'pointer' : 'default' }}
            title={`${d.label}: ${fmtL(d.total)}`}
          >
            <div
              className="w-full rounded-t-[3px] transition-[height,background] duration-300"
              style={{
                height: h,
                background: d.total > 0 ? (selected ? 'var(--accent-3)' : 'var(--accent)') : 'var(--line)',
                opacity: d.total > 0 ? 1 : 0.4,
                outline: selected ? '2px solid rgba(201,100,66,0.28)' : 'none',
                outlineOffset: 2,
              }}
            />
            {showLabels && i % Math.ceil(data.length / 8) === 0 && (
              <div className="absolute bottom-[-18px] text-[9px] text-[var(--ink-3)] whitespace-nowrap -translate-x-1/2 left-1/2">{d.label}</div>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default function AnaliticasClient() {
  const router = useRouter();
  const shellRef = useRef<HTMLDivElement>(null);
  const [preset, setPreset] = useState<Preset>('mes');
  const [customDesde, setCustomDesde] = useState('');
  const [customHasta, setCustomHasta] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCompact, setIsCompact] = useState(false);
  const [isNarrow, setIsNarrow] = useState(false);
  const tiendaId = useRef<string | null>(null);

  async function cargar(p: Preset, cDesde?: string, cHasta?: string) {
    setLoading(true);
    const { desde, hasta } = getRange(p, cDesde, cHasta);
    const supabase = createClient();

    if (!tiendaId.current) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      const { data: t } = await supabase.from('tiendas').select('id').eq('user_id', user.id as never).maybeSingle();
      if (!t) { router.push('/onboarding'); return; }
      tiendaId.current = (t as { id: string }).id;
    }

    const { data } = await supabase
      .from('pedidos')
      .select(`
        id, numero, comprador_nombre, comprador_email, monto_total, estado, created_at,
        pedido_items ( precio, talla_seleccionada, prendas ( nombre, marca ) )
      `)
      .eq('tienda_id', tiendaId.current! as never)
      .not('estado', 'in', '(cancelado,apartado)')
      .gte('created_at', desde.toISOString())
      .lte('created_at', hasta.toISOString())
      .order('created_at', { ascending: true });

    setPedidos((data as unknown as Pedido[]) ?? []);
    setSelectedDate(null);
    setLoading(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void cargar('mes');
    }, 0);
    return () => window.clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const node = shellRef.current;
    if (!node) return;
    const update = () => {
      setIsCompact(node.clientWidth <= 900);
      setIsNarrow(node.clientWidth <= 560);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

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
  const selectedPoint = selectedDate ? chartData.find(d => d.date === selectedDate) ?? null : null;
  const selectedPedidos = selectedPoint
    ? pedidos.filter(p => {
        if (!p.created_at) return false;
        const k = dayKey(p.created_at);
        return k >= selectedPoint.desde && k <= selectedPoint.hasta;
      })
    : [];
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
    <div ref={shellRef} className="analytics-shell h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div
        className={`analytics-header border-b border-[var(--line)] shrink-0 bg-[rgba(255,255,255,0.68)] backdrop-blur-[18px] flex flex-wrap ${isCompact ? 'flex-col items-stretch px-4 pt-[18px] pb-[14px]' : 'items-center justify-between px-7 pt-[18px] pb-[14px]'}`}
        style={{ gap: isCompact ? 12 : 20 }}
      >
        <div>
          <div className="text-[20px] font-black tracking-[-0.025em]">Analíticas</div>
          <div className="t-mute text-[13px] mt-[2px]">{label}</div>
        </div>

        <div className="analytics-header-actions flex items-center gap-2 flex-wrap">
          <div className={`analytics-period-tabs flex gap-1 bg-[var(--surface-2)] rounded-[10px] p-[3px] ${isCompact ? 'w-full' : ''}`}>
            {PRESETS.map(pr => (
              <button
                key={pr.id}
                onClick={() => handlePreset(pr.id)}
                className={`px-3 py-[5px] rounded-[7px] text-[12px] font-semibold flex items-center gap-[5px] transition-all duration-[120ms] ${isCompact ? 'flex-1 justify-center' : ''} ${preset === pr.id ? 'bg-white text-[var(--accent-3)] shadow-[0_1px_4px_rgba(0,0,0,0.08)]' : 'bg-transparent text-[var(--ink-3)]'}`}
              >
                {pr.id === 'custom' && <Icons.filter width={11} height={11} />}
                {pr.label}
              </button>
            ))}
          </div>

          {/* Custom date range inputs */}
          {showCustom && (
            <div className={`analytics-custom-range flex items-center gap-[6px] bg-[var(--surface-2)] rounded-[10px] px-[10px] py-[5px] border-[1.5px] border-[rgba(201,100,66,0.25)] ${isCompact ? 'w-full flex-wrap' : ''}`}>
              <input
                type="date"
                value={customDesde}
                max={customHasta || todayStr}
                onChange={e => setCustomDesde(e.target.value)}
                className="text-[12px] bg-transparent border-none outline-none text-[var(--ink)] font-[inherit] cursor-pointer"
              />
              <span className="text-[var(--ink-3)] text-[11px]">→</span>
              <input
                type="date"
                value={customHasta}
                min={customDesde || undefined}
                max={todayStr}
                onChange={e => setCustomHasta(e.target.value)}
                className="text-[12px] bg-transparent border-none outline-none text-[var(--ink)] font-[inherit] cursor-pointer"
              />
              <button
                onClick={handleApplyCustom}
                disabled={!customDesde || !customHasta}
                className={`px-[10px] py-[3px] rounded-[6px] text-[11px] font-bold transition-all duration-[120ms] ${customDesde && customHasta ? 'bg-[var(--accent)] text-white' : 'bg-[var(--line)] text-[var(--ink-3)]'}`}
              >
                Aplicar
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="analytics-content flex-1 overflow-y-auto" style={{ padding: isCompact ? '14px 14px 120px' : '20px 28px 28px' }}>
        {/* KPIs */}
        <div
          className="analytics-kpi-grid grid"
          style={{
            gridTemplateColumns: isNarrow ? '1fr' : isCompact ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, 1fr)',
            gap: isCompact ? 10 : 12,
            marginBottom: isCompact ? 16 : 24,
          }}
        >
          {[
            { label: 'Ingresos totales', value: loading ? '…' : fmtL(totalVentas), sub: 'pedidos cobrados', accent: true },
            { label: 'Pedidos', value: loading ? '…' : String(totalPedidos), sub: 'confirmados en el período', accent: false },
            { label: 'Ticket promedio', value: loading ? '…' : fmtL(ticketPromedio), sub: 'por pedido', accent: false },
            { label: 'Prendas vendidas', value: loading ? '…' : String(totalItems), sub: 'unidades en el período', accent: false },
          ].map(k => (
            <div
              key={k.label}
              className={`card analytics-kpi-card ${k.accent ? 'bg-[linear-gradient(135deg,#E78C61_0%,#C96442_100%)] border-0 shadow-[0_8px_24px_rgba(201,100,66,0.22)]' : ''}`}
              style={{ padding: isCompact ? '16px' : '18px 20px' }}
            >
              <div className={`text-[11px] font-bold uppercase tracking-[0.06em] mb-2 ${k.accent ? 'text-[rgba(255,255,255,0.75)]' : 'text-[var(--ink-3)]'}`}>
                {k.label}
              </div>
              <div className={`tnum font-black tracking-[-0.03em] ${k.accent ? 'text-white' : 'text-[var(--ink)]'}`} style={{ fontSize: isCompact ? 22 : 26 }}>
                {k.value}
              </div>
              <div className={`text-[11px] mt-1 ${k.accent ? 'text-[rgba(255,255,255,0.7)]' : 'text-[var(--ink-3)]'}`}>{k.sub}</div>
            </div>
          ))}
        </div>

        {/* Ventas por día */}
        <div className="card analytics-chart-card" style={{ padding: isCompact ? '16px 14px' : '20px 22px', marginBottom: isCompact ? 14 : 20 }}>
          <div className="flex items-center justify-between mb-4">
            <div className="text-[14px] font-extrabold">Ventas por día</div>
            {!loading && totalVentas > 0 && (
              <div className="mono t-mute text-[12px]">
                pico: {fmtL(Math.max(...chartData.map(d => d.total)))}
              </div>
            )}
          </div>
          {loading ? (
            <div className="h-[100px] bg-[var(--surface-2)] rounded-lg animate-pulse" />
          ) : (
            <BarChart data={chartData} selectedDate={selectedDate} onSelect={setSelectedDate} />
          )}
          {!loading && totalVentas > 0 && (
            <div className="mt-4 border-t border-[var(--line)] pt-[14px]">
              <div className="flex items-center justify-between gap-3 mb-[10px]">
                <div className="text-[13px] font-extrabold">
                  {selectedPoint ? `Detalle · ${selectedPoint.label}` : 'Detalle de barra'}
                </div>
                {selectedPoint && (
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setSelectedDate(null)}>
                    Limpiar
                  </button>
                )}
              </div>
              {!selectedPoint ? (
                <div className="t-mute text-[12px] py-[10px]">Seleccioná una barrita para ver solo sus pedidos.</div>
              ) : selectedPedidos.length === 0 ? (
                <div className="t-mute text-[12px] py-[10px]">No hay pedidos en esta barra.</div>
              ) : (
                <div className="max-h-[240px] overflow-y-auto border border-[var(--line)] rounded-lg">
                  <div className="mono grid grid-cols-[100px_1fr_1fr_110px_110px] gap-[10px] px-3 py-[9px] border-b border-[var(--line)] text-[10px] text-[var(--ink-3)] uppercase sticky top-0 bg-white z-[1]">
                    <div>Pedido</div><div>Comprador</div><div>Prenda</div><div>Monto</div><div>Fecha</div>
                  </div>
                  {selectedPedidos.map(p => {
                    const item = p.pedido_items[0];
                    const prenda = item?.prendas ? [item.prendas.marca, item.prendas.nombre].filter(Boolean).join(' ') : '—';
                    return (
                      <div key={p.id} className="grid grid-cols-[100px_1fr_1fr_110px_110px] gap-[10px] px-3 py-[10px] border-b border-[var(--line-2)] items-center text-[12px]">
                        <div className="mono tnum font-extrabold">{p.numero}</div>
                        <div className="whitespace-nowrap overflow-hidden text-ellipsis">{p.comprador_nombre}</div>
                        <div className="t-mute whitespace-nowrap overflow-hidden text-ellipsis">{prenda}</div>
                        <div className="mono tnum font-extrabold">{fmtL(p.monto_total)}</div>
                        <div className="t-mute">{fmtFecha(p.created_at)}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom grid */}
        <div
          className="analytics-bottom-grid grid"
          style={{ gridTemplateColumns: isCompact ? '1fr' : '1fr 1fr', gap: isCompact ? 14 : 20, marginBottom: isCompact ? 14 : 20 }}
        >
          {/* Top clientes */}
          <div className="card analytics-list-card overflow-hidden">
            <div className="px-[18px] pt-4 pb-3 border-b border-[var(--line)] flex items-center gap-2">
              <Icons.user width={14} height={14} className="text-[var(--accent)]" />
              <div className="text-[14px] font-extrabold">Mejores clientes</div>
            </div>
            {loading ? (
              <div className="p-7 text-center text-[var(--ink-3)] text-[13px]">Cargando...</div>
            ) : topClientes.length === 0 ? (
              <div className="p-7 text-center text-[var(--ink-3)] text-[13px]">Sin datos en este período</div>
            ) : <div className="max-h-[320px] overflow-y-auto">{topClientes.map((c, i) => (
              <div key={i} className={`px-[18px] py-[10px] ${i < topClientes.length - 1 ? 'border-b border-[var(--line-2)]' : ''}`}>
                <div className="flex items-center justify-between mb-[5px]">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-[22px] h-[22px] rounded-full shrink-0 flex items-center justify-center text-[9px] font-black ${i === 0 ? 'bg-[linear-gradient(135deg,var(--accent),var(--accent-3))] text-white' : 'bg-[var(--surface-2)] text-[var(--ink-3)]'}`}>
                      {i + 1}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[12px] font-bold whitespace-nowrap overflow-hidden text-ellipsis">{c.nombre}</div>
                      {c.email && <div className="t-mute text-[10px] whitespace-nowrap overflow-hidden text-ellipsis">{c.email}</div>}
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <div className="mono tnum text-[12px] font-bold">{fmtL(c.total)}</div>
                    <div className="t-mute text-[10px]">{c.pedidos} pedido{c.pedidos !== 1 ? 's' : ''}</div>
                  </div>
                </div>
                <MiniBar value={c.total} max={maxCliente} />
              </div>
            ))}</div>}
          </div>

          {/* Tallas */}
          <div className="card analytics-list-card overflow-hidden">
            <div className="px-[18px] pt-4 pb-3 border-b border-[var(--line)] flex items-center gap-2">
              <Icons.grid width={14} height={14} className="text-[var(--accent)]" />
              <div className="text-[14px] font-extrabold">Ventas por talla</div>
            </div>
            {loading ? (
              <div className="p-7 text-center text-[var(--ink-3)] text-[13px]">Cargando...</div>
            ) : tallaStats.length === 0 ? (
              <div className="p-7 text-center text-[var(--ink-3)] text-[13px]">Sin datos en este período</div>
            ) : <div className="max-h-[320px] overflow-y-auto">{tallaStats.map((t, i) => (
              <div key={i} className={`px-[18px] py-[10px] ${i < tallaStats.length - 1 ? 'border-b border-[var(--line-2)]' : ''}`}>
                <div className="flex items-center justify-between mb-[5px]">
                  <div className="flex items-center gap-2">
                    <div className="min-w-[32px] h-[22px] rounded-[5px] px-[6px] bg-[var(--surface-2)] flex items-center justify-center text-[10px] font-extrabold font-[var(--font-mono)] text-[var(--ink-2)]">
                      {t.talla}
                    </div>
                    <div className="t-mute text-[12px]">{t.unidades} unidad{t.unidades !== 1 ? 'es' : ''}</div>
                  </div>
                  <div className="mono tnum text-[12px] font-bold">{fmtL(t.total)}</div>
                </div>
                <MiniBar value={t.unidades} max={maxTalla} color="#7B6B8F" />
              </div>
            ))}</div>}
          </div>
        </div>

        {/* Top prendas */}
        <div className="card analytics-top-products-card overflow-hidden">
          <div className="px-[18px] pt-4 pb-3 border-b border-[var(--line)] flex items-center gap-2">
            <Icons.sparkle width={14} height={14} className="text-[var(--accent)]" />
            <div className="text-[14px] font-extrabold">Prendas más vendidas</div>
          </div>
          {loading ? (
            <div className="p-7 text-center text-[var(--ink-3)] text-[13px]">Cargando...</div>
          ) : topPrendas.length === 0 ? (
            <div className="p-7 text-center text-[var(--ink-3)] text-[13px]">Sin datos en este período</div>
          ) : (
            <>
              <div
                className={`analytics-products-head mono border-b border-[var(--line-2)] px-[18px] py-[9px] text-[10px] text-[var(--ink-3)] uppercase tracking-[0.05em] grid-cols-[28px_1fr_80px_80px_80px_120px] ${isCompact ? 'hidden' : 'grid'}`}
              >
                <div>#</div><div>Prenda</div><div>Talla</div><div className="text-right">Und.</div><div className="text-right">Total</div><div className="pl-2">Popularidad</div>
              </div>
              <div className="max-h-[360px] overflow-y-auto">
              {topPrendas.map((p, i) => (
                <div
                  className={`analytics-product-row grid items-center ${i < topPrendas.length - 1 ? 'border-b border-[var(--line-2)]' : ''}`}
                  key={i}
                  style={{
                    gridTemplateColumns: isCompact ? '28px minmax(0, 1fr) auto' : '28px 1fr 80px 80px 80px 120px',
                    gap: isCompact ? '6px 10px' : undefined,
                    padding: isCompact ? '12px 14px' : '10px 18px',
                  }}
                >
                  <div className="mono t-mute text-[11px]">{i + 1}</div>
                  <div className={`text-[12px] font-semibold overflow-hidden ${isCompact ? 'whitespace-normal' : 'whitespace-nowrap text-ellipsis pr-3'}`}>{p.nombre}</div>
                  <div>
                    <span className="inline-block px-[7px] py-[2px] rounded-[4px] bg-[var(--surface-2)] text-[10px] font-extrabold font-[var(--font-mono)]">
                      {p.talla}
                    </span>
                  </div>
                  <div className={`mono tnum text-[12px] font-bold text-right ${isCompact ? 'col-[2/3]' : ''}`}>{isCompact ? `${p.unidades} und.` : p.unidades}</div>
                  <div className="mono tnum text-[12px] font-bold text-right">{fmtL(p.total)}</div>
                  <div className={`w-full ${isCompact ? 'col-[2/4]' : 'pl-2'}`}>
                    <MiniBar value={p.unidades} max={maxPrenda} color="var(--accent)" />
                  </div>
                </div>
              ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
