'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { ConfirmModal } from '@/components/shared/confirm-modal';
import { useRouter } from 'next/navigation';
import { CountdownTimer } from '@/components/drops/countdown-timer';
import { Icons } from '@/components/shared/icons';
import { Ph } from '@/components/shared/image-placeholder';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/config/platform';
import { TONES } from '@/lib/ui/tones';
import { getProductTotalQuantity } from '@/lib/product-sizes';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

interface Tienda {
  id: string;
  nombre: string;
  username: string;
}

interface Drop {
  id: string;
  nombre: string;
  descripcion: string | null;
  estado: string | null;
  inicia_at: string;
  cierra_at: string | null;
  created_at: string | null;
  vendidas_count: number | null;
  viewers_count: number | null;
  recaudado_total: number | null;
  foto_portada_url: string | null;
}

interface PrendaResumen {
  id: string;
  drop_id: string | null;
  estado: string | null;
  cantidad: number | null;
  cantidades_por_talla: Record<string, number> | null;
  talla: string | null;
  tallas: string[] | null;
  precio: number | null;
}

type FiltroDrop = 'todos' | 'activos' | 'programados' | 'cerrados';

interface ResumenDrop {
  total: number;
  vendidas: number;
  apartadas: number;
  sinVender: number;
  remanentes: number;
  valorTotal: number;
  valorApartado: number;
}

function fmtFecha(iso: string | null | undefined): string {
  if (!iso) return 'Sin fecha';
  const d = new Date(iso);
  const m = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'][d.getMonth()];
  return `${d.getDate()} ${m} · ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function dinero(valor: number | null | undefined): string {
  return formatCurrency(valor ?? 0);
}

function statusInfo(estado: string | null | undefined) {
  if (estado === 'activo') return { label: 'En vivo', badge: 'badge badge-live', tone: 'var(--urgent)' };
  if (estado === 'programado') return { label: 'Programado', badge: 'badge', tone: '#2563eb' };
  if (estado === 'cerrado') return { label: 'Cerrado', badge: 'badge badge-sold', tone: 'var(--ink)' };
  return { label: 'Borrador', badge: 'badge', tone: 'var(--ink-3)' };
}

function resumenVacio(): ResumenDrop {
  return { total: 0, vendidas: 0, apartadas: 0, sinVender: 0, remanentes: 0, valorTotal: 0, valorApartado: 0 };
}

function DropThumb({ drop, tone }: { drop: Drop; tone: typeof TONES[number] }) {
  return (
    <div className="w-11 h-11 rounded-lg overflow-hidden bg-[var(--surface-2)] shrink-0">
      {drop.foto_portada_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img loading="lazy" src={drop.foto_portada_url} alt="" className="w-full h-full object-cover block"/>
      ) : (
        <Ph tone={tone} radius={8}/>
      )}
    </div>
  );
}

function MetricCard({ label, value, help, icon: Icon }: {
  label: string;
  value: string;
  help: string;
  icon: (p: React.SVGProps<SVGSVGElement> & { width?: number; height?: number }) => React.ReactNode;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="mono t-mute text-[11px] uppercase tracking-[0]">{label}</div>
        <div className="w-[30px] h-[30px] rounded-lg bg-[var(--surface-2)] flex items-center justify-center text-[var(--ink-2)]">
          <Icon width={14} height={14}/>
        </div>
      </div>
      <div className="tnum text-[27px] font-bold mt-2">{value}</div>
      <div className="t-mute text-[12px] mt-[3px]">{help}</div>
    </div>
  );
}

function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="px-4 py-[38px] text-center">
      <div className="w-11 h-11 rounded-xl bg-[var(--surface-2)] flex items-center justify-center mx-auto mb-3 text-[var(--ink-3)]">
        <Icons.sparkle width={18} height={18}/>
      </div>
      <div className="text-[14px] font-semibold mb-[5px]">{title}</div>
      <div className={`t-mute text-[13px]${action ? ' mb-4' : ''}`}>{body}</div>
      {action}
    </div>
  );
}

export default function DropsPage() {
  const router = useRouter();
  const [tienda, setTienda] = useState<Tienda | null>(null);
  const [drops, setDrops] = useState<Drop[]>([]);
  const [prendas, setPrendas] = useState<PrendaResumen[]>([]);
  const [comprobantesPendientes, setComprobantesPendientes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<FiltroDrop>('todos');
  const [busqueda, setBusqueda] = useState('');
  const [dropCerradoId, setDropCerradoId] = useState<string>('');
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [confirmDeleteDrop, setConfirmDeleteDrop] = useState<string | null>(null);
  const [deletePending, startDeleteTransition] = useTransition();

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    async function cargar() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const { data: t } = await supabase
        .from('tiendas')
        .select('id, nombre, username')
        .eq('user_id', user.id as never)
        .single();

      if (!t) { router.push('/onboarding'); return; }
      const tiendaData = t as { id: string; nombre: string; username: string };
      setTienda(tiendaData);

      const { data: dropsData } = await supabase
        .from('drops')
        .select('id, nombre, descripcion, estado, inicia_at, cierra_at, created_at, vendidas_count, viewers_count, recaudado_total, foto_portada_url')
        .eq('tienda_id', tiendaData.id as never)
        .order('inicia_at', { ascending: false })
        .limit(80);

      let loadedDrops = (dropsData ?? []) as Drop[];

      // Auto-activate programado drops whose inicia_at has already passed
      const now = Date.now();
      const expired = loadedDrops.filter(d =>
        d.estado === 'programado' && new Date(d.inicia_at).getTime() < now
      );
      if (expired.length > 0) {
        await supabase.from('drops').update({ estado: 'activo' } as any).in('id', expired.map(d => d.id));
        const expiredIds = new Set(expired.map(d => d.id));
        loadedDrops = loadedDrops.map(d => expiredIds.has(d.id) ? { ...d, estado: 'activo' } : d);
      }

      setDrops(loadedDrops);

      if (loadedDrops.length) {
        const { data: prendasData } = await supabase
          .from('prendas')
          .select('id, drop_id, estado, cantidad, cantidades_por_talla, talla, tallas, precio')
          .in('drop_id', loadedDrops.map(d => d.id));
        setPrendas((prendasData ?? []) as PrendaResumen[]);
      } else {
        setPrendas([]);
      }

      const { count } = await supabase
        .from('comprobantes')
        .select('id', { count: 'exact', head: true })
        .eq('tienda_id', tiendaData.id as never)
        .eq('estado', 'pendiente' as never);

      setComprobantesPendientes(count ?? 0);
      setLoading(false);
    }
    cargar();
  }, [router]);

  const resumenes = useMemo(() => {
    const map = new Map<string, ResumenDrop>();
    drops.forEach(d => map.set(d.id, resumenVacio()));

    prendas.forEach(p => {
      if (!p.drop_id) return;
      const r = map.get(p.drop_id) ?? resumenVacio();
      const precio = p.precio ?? 0;
      const cantidad = getProductTotalQuantity(p);
      r.total += cantidad;
      r.valorTotal += precio * cantidad;
      if (p.estado === 'vendida') r.vendidas += cantidad;
      if (p.estado === 'apartada') {
        r.apartadas += cantidad;
        r.valorApartado += precio * cantidad;
      }
      if (p.estado === 'remanente') r.remanentes += cantidad;
      if (p.estado !== 'vendida' && p.estado !== 'apartada') r.sinVender += cantidad;
      map.set(p.drop_id, r);
    });

    return map;
  }, [drops, prendas]);

  const cerrados = useMemo(() => drops.filter(d => d.estado === 'cerrado'), [drops]);
  const activos = useMemo(() => drops.filter(d => d.estado === 'activo' || d.estado === 'programado'), [drops]);

  const cerradoSeleccionado = cerrados.find(d => d.id === dropCerradoId) ?? cerrados[0] ?? null;
  const resumenSeleccionado = cerradoSeleccionado ? (resumenes.get(cerradoSeleccionado.id) ?? resumenVacio()) : resumenVacio();

  const historial = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return drops.filter(d => {
      const matchFiltro =
        filtro === 'todos' ? true :
        filtro === 'activos' ? d.estado === 'activo' :
        filtro === 'programados' ? d.estado === 'programado' :
        d.estado === 'cerrado';

      const matchBusqueda = !q ||
        d.nombre.toLowerCase().includes(q) ||
        (d.descripcion ?? '').toLowerCase().includes(q);

      return matchFiltro && matchBusqueda;
    });
  }, [drops, filtro, busqueda]);

  const stats = useMemo(() => {
    const totalCerrado = cerrados.reduce((s, d) => s + (d.recaudado_total ?? 0), 0);
    const vendidas = drops.reduce((s, d) => s + ((resumenes.get(d.id)?.vendidas ?? d.vendidas_count) || 0), 0);
    const apartadas = drops.reduce((s, d) => s + (resumenes.get(d.id)?.apartadas ?? 0), 0);
    return {
      activos: drops.filter(d => d.estado === 'activo').length,
      programados: drops.filter(d => d.estado === 'programado').length,
      cerrados: cerrados.length,
      totalCerrado,
      vendidas,
      apartadas,
    };
  }, [drops, cerrados, resumenes]);

  async function activarDrop(dropId: string) {
    const supabase = createClient();
    const now = new Date().toISOString();
    const { error } = await supabase.from('drops').update({ estado: 'activo', inicia_at: now } as any).eq('id', dropId as never);
    if (error) { toast.error(error.message); return; }
    setDrops(prev => prev.map(d => d.id === dropId ? { ...d, estado: 'activo', inicia_at: now } : d));
    toast.success('Drop activado');
  }

  async function cerrarDrop(dropId: string) {
    const supabase = createClient();
    const { error } = await supabase.from('drops').update({ estado: 'cerrado' } as any).eq('id', dropId as never);
    if (error) { toast.error(error.message); return; }
    setDrops(prev => prev.map(d => d.id === dropId ? { ...d, estado: 'cerrado' } : d));

    await supabase
      .from('prendas')
      .update({ estado: 'disponible', remanente_hasta: null, drop_id: null } as any)
      .eq('drop_id', dropId as never)
      .eq('estado', 'disponible' as never);
    setPrendas(prev => prev.filter(p => !(p.drop_id === dropId && p.estado === 'disponible')));

    toast.success('Drop cerrado — prendas sin vender pasadas a inventario');
  }

  async function eliminarDrop(dropId: string) {
    const supabase = createClient();
    const { error } = await supabase.from('drops').delete().eq('id', dropId as never);
    if (error) { toast.error(error.message); return; }
    setDrops(prev => prev.filter(d => d.id !== dropId));
    setPrendas(prev => prev.filter(p => p.drop_id !== dropId));
    toast.success('Drop eliminado');
  }

  function copiarLink(dropId: string) {
    if (!tienda) return;
    const url = `${window.location.origin}/${tienda.username}/drop/${dropId}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copiado al portapapeles');
  }

  const filtros: { id: FiltroDrop; label: string; count: number }[] = [
    { id: 'todos', label: 'Todos', count: drops.length },
    { id: 'activos', label: 'En vivo', count: stats.activos },
    { id: 'programados', label: 'Programados', count: stats.programados },
    { id: 'cerrados', label: 'Cerrados', count: stats.cerrados },
  ];

  return (
    <div className="drops-page-shell h-full flex flex-col overflow-hidden">
      <div className="drops-page-header px-7 pt-5 pb-4 border-b border-[var(--line)] flex items-end justify-between gap-5 shrink-0">
        <div>
          <div className="text-[22px] font-bold">Drops</div>
          <div className="t-mute text-[13px] mt-[3px]">
            {loading ? 'Cargando drops...' : `${stats.activos} en vivo · ${stats.programados} programados · ${stats.cerrados} cerrados`}
          </div>
        </div>
        <div className="drops-header-actions flex gap-2">
          {tienda && (
            <button onClick={() => router.push(`/${tienda.username}`)} className="btn btn-outline btn-sm">
              <Icons.eye width={13} height={13}/> Vista compradora
            </button>
          )}
          <button onClick={() => router.push('/drops/nuevo')} className="btn btn-primary btn-sm">
            <Icons.plus width={13} height={13}/> Nuevo drop
          </button>
        </div>
      </div>

      <div className="drops-page-content flex-1 overflow-y-auto px-7 pt-5 pb-7">
        <div className="drops-metrics-grid grid gap-3 mb-5 grid-cols-[repeat(auto-fit,minmax(190px,1fr))]">
          <MetricCard label="Drops activos" value={String(stats.activos)} help={`${stats.programados} programados en cola`} icon={Icons.sparkle}/>
          <MetricCard label="Cerrados" value={String(stats.cerrados)} help={`${dinero(stats.totalCerrado)} recaudados`} icon={Icons.check}/>
          <MetricCard label="Unidades vendidas" value={String(stats.vendidas)} help={`${stats.apartadas} apartadas pendientes`} icon={Icons.bag}/>
          <MetricCard label="Comprobantes" value={String(comprobantesPendientes)} help="Pagos por verificar" icon={Icons.inbox}/>
        </div>

        <div className="drops-overview-grid grid gap-5 items-start mb-6 grid-cols-[minmax(360px,1.05fr)_minmax(420px,1.35fr)]">
          <section>
            <div className="drops-section-heading flex items-center justify-between mb-[10px]">
              <div className="text-[15px] font-bold">En curso y próximos</div>
              <button onClick={() => router.push('/drops/nuevo')} className="btn btn-outline btn-sm">
                <Icons.plus width={12} height={12}/> Crear
              </button>
            </div>
            <div className="card overflow-hidden">
              {loading ? (
                <div className="p-6 text-[var(--ink-3)] text-[13px] text-center">Cargando...</div>
              ) : activos.length === 0 ? (
                <EmptyState
                  title="No hay drops activos"
                  body="Creá o programá el próximo lanzamiento desde aquí."
                  action={<button onClick={() => router.push('/drops/nuevo')} className="btn btn-primary btn-sm"><Icons.plus width={13} height={13}/> Nuevo drop</button>}
                />
              ) : (
                activos.map((d, i) => {
                  const s = statusInfo(d.estado);
                  const resumen = resumenes.get(d.id) ?? resumenVacio();
                  const targetMs = d.estado === 'activo' && d.cierra_at
                    ? new Date(d.cierra_at).getTime()
                    : d.estado === 'programado'
                      ? new Date(d.inicia_at).getTime()
                      : null;
                  const showCountdown = targetMs !== null && targetMs > nowMs;
                  return (
                    <div
                      key={d.id}
                      onClick={() => router.push(`/drops/${d.id}`)}
                      className={`drops-active-row px-4 py-[14px] flex items-center gap-3 cursor-pointer${i < activos.length - 1 ? ' border-b border-[var(--line)]' : ''}`}
                    >
                      <DropThumb drop={d} tone={TONES[i % TONES.length]}/>
                      <div className="drops-active-copy flex-1 min-w-0">
                        <div className="drops-active-title-row flex gap-2 items-center">
                          <div className="text-[13px] font-bold whitespace-nowrap overflow-hidden text-ellipsis">{d.nombre}</div>
                          <span className={s.badge}>{d.estado === 'activo' && <span className="dot"/>}{s.label}</span>
                        </div>
                        <div className="t-mute text-[12px] mt-[3px]">
                          {resumen.total} unidades · {resumen.vendidas || d.vendidas_count || 0} vendidas · {dinero(d.recaudado_total)}
                        </div>
                      </div>
                      <div className="drops-active-countdown mono tnum text-[12px] min-w-[78px] text-right" style={{ color: s.tone }}>
                        {showCountdown && targetMs !== null && (
                          <CountdownTimer
                            target={targetMs}
                            size="sm"
                            onExpire={d.estado === 'programado' ? () => activarDrop(d.id) : undefined}
                          />
                        )}
                      </div>
                      <div className="drops-active-menu" onClick={e => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="btn btn-ghost btn-sm">
                              <Icons.more width={14} height={14}/>
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => router.push(`/drops/${d.id}`)}>
                              <Icons.eye width={14} height={14}/> Ver detalle
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => copiarLink(d.id)}>
                              <Icons.share width={14} height={14}/> Copiar link
                            </DropdownMenuItem>
                            {d.estado === 'programado' && (
                              <DropdownMenuItem onSelect={() => activarDrop(d.id)}>
                                <Icons.sparkle width={14} height={14}/> Activar ahora
                              </DropdownMenuItem>
                            )}
                            {d.estado === 'activo' && (
                              <DropdownMenuItem onSelect={() => cerrarDrop(d.id)}>
                                <Icons.clock width={14} height={14}/> Cerrar drop
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator/>
                            <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDeleteDrop(d.id)}>
                              <Icons.trash width={14} height={14}/> Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          <section>
            <div className="drops-section-heading flex items-center justify-between mb-[10px]">
              <div className="text-[15px] font-bold">Resumen de drop cerrado</div>
              {cerrados.length > 0 && (
                <select className="drops-closed-select input w-[220px] h-8 text-[12px]" value={cerradoSeleccionado?.id ?? ''} onChange={e => setDropCerradoId(e.target.value)}>
                  {cerrados.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                </select>
              )}
            </div>
            <div className="card p-0 overflow-hidden">
              {loading ? (
                <div className="p-6 text-[var(--ink-3)] text-[13px] text-center">Cargando resumen...</div>
              ) : !cerradoSeleccionado ? (
                <EmptyState title="Todavía no hay drops cerrados" body="Cuando cierres un drop, su recaudación, remanentes y apartados aparecerán aquí."/>
              ) : (
                <>
                  <div className="drops-closed-summary p-[22px] grid grid-cols-[72px_1fr_auto] gap-4 items-center">
                    <div className="w-[72px] h-[90px] rounded-[10px] overflow-hidden bg-[var(--surface-2)]">
                      {cerradoSeleccionado.foto_portada_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img loading="lazy" src={cerradoSeleccionado.foto_portada_url} alt="" className="w-full h-full object-cover block"/>
                      ) : <Ph tone="sand" aspect="4/5" radius={10}/>}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-[6px]">
                        <span className="badge badge-sold">Cerrado</span>
                        <span className="t-mute text-[12px]">{fmtFecha(cerradoSeleccionado.cierra_at ?? cerradoSeleccionado.inicia_at)}</span>
                      </div>
                      <div className="text-[18px] font-bold whitespace-nowrap overflow-hidden text-ellipsis">{cerradoSeleccionado.nombre}</div>
                      <div className="t-mute text-[12px] mt-[2px]">{resumenSeleccionado.total} unidades publicadas</div>
                    </div>
                    <div className="drops-closed-total text-right">
                      <div className="mono t-mute text-[10px] uppercase tracking-[0]">Total recaudado</div>
                      <div className="tnum text-[34px] leading-[1.05] font-extrabold">{dinero(cerradoSeleccionado.recaudado_total)}</div>
                      {resumenSeleccionado.valorApartado > 0 && (
                        <div className="t-mute text-[12px] mt-1">+ {dinero(resumenSeleccionado.valorApartado)} pendientes</div>
                      )}
                    </div>
                  </div>

                  <div className="drops-closed-stats border-t border-[var(--line)] border-b border-[var(--line)] px-[18px] py-[14px] grid grid-cols-4 gap-[10px]">
                    {[
                      ['Vendidas', resumenSeleccionado.vendidas || cerradoSeleccionado.vendidas_count || 0],
                      ['Apartadas', resumenSeleccionado.apartadas],
                      ['Sin vender', resumenSeleccionado.sinVender],
                      ['Viewers', cerradoSeleccionado.viewers_count ?? 0],
                    ].map(([label, value]) => (
                      <div key={label} className="text-center">
                        <div className="tnum text-[22px] font-bold">{value}</div>
                        <div className="t-mute text-[11px]">{label}</div>
                      </div>
                    ))}
                  </div>

                  <div className="drops-closed-actions p-4 grid grid-cols-3 gap-[10px]">
                    <button onClick={() => router.push('/pedidos')} className="btn btn-outline h-[46px]">
                      <Icons.bag width={14} height={14}/> Ver pedidos
                    </button>
                    <button onClick={() => router.push('/comprobantes')} className="btn btn-outline h-[46px]">
                      <Icons.inbox width={14} height={14}/> Verificar
                    </button>
                    <button onClick={() => router.push(`/drops/${cerradoSeleccionado.id}`)} className="btn btn-primary h-[46px]">
                      Ver detalle <Icons.arrow width={14} height={14}/>
                    </button>
                  </div>
                </>
              )}
            </div>
          </section>
        </div>

        <section>
          <div className="drops-history-toolbar flex items-center justify-between gap-4 mb-[10px]">
            <div>
              <div className="text-[15px] font-bold">Historial de drops</div>
              <div className="t-mute text-[12px] mt-[2px]">Todos tus lanzamientos con estado, resultados y acciones.</div>
            </div>
            <div className="drops-history-controls flex items-center gap-2">
              <div className="drops-history-search relative w-[260px]">
                <Icons.search width={14} height={14} className="absolute left-[11px] top-[9px] text-[var(--ink-3)]"/>
                <input
                  className="input h-[34px] pl-8 text-[12px]"
                  placeholder="Buscar drop..."
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                />
              </div>
              <div className="drops-filter-row flex gap-1">
                {filtros.map(f => (
                  <button
                    key={f.id}
                    onClick={() => setFiltro(f.id)}
                    className={`h-[34px] px-[10px] rounded-lg text-[12px] font-semibold inline-flex items-center gap-[6px] border ${filtro === f.id ? 'bg-[var(--ink)] text-white border-[var(--ink)]' : 'bg-white text-[var(--ink-3)] border-[var(--line)]'}`}
                  >
                    {f.label}
                    <span className="mono tnum opacity-70">{f.count}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="drops-history-card card overflow-hidden">
            <div className="drops-history-head mono grid grid-cols-[2fr_120px_130px_90px_90px_90px_110px_130px_34px] px-4 py-[10px] border-b border-[var(--line)] text-[11px] text-[var(--ink-3)] uppercase tracking-[0]">
              <div>Drop</div><div>Estado</div><div>Fecha</div><div>Unidades</div><div>Vendidas</div><div>Sin vender</div><div>Viewers</div><div>Recaudado</div><div/>
            </div>
            {loading ? (
              <div className="p-8 text-[var(--ink-3)] text-[13px] text-center">Cargando historial...</div>
            ) : historial.length === 0 ? (
              <EmptyState title="Sin resultados" body={busqueda ? 'Intentá con otro nombre o filtro.' : 'Creá tu primer drop para empezar el historial.'}/>
            ) : (
              historial.map((d, i) => {
                const s = statusInfo(d.estado);
                const r = resumenes.get(d.id) ?? resumenVacio();
                return (
                  <div
                    key={d.id}
                    onClick={() => router.push(`/drops/${d.id}`)}
                    className={`drops-history-row grid grid-cols-[2fr_120px_130px_90px_90px_90px_110px_130px_34px] px-4 py-3 items-center text-[12px] cursor-pointer${i < historial.length - 1 ? ' border-b border-[var(--line-2)]' : ''}`}
                  >
                    <div className="drops-history-main flex items-center gap-3 min-w-0">
                      <DropThumb drop={d} tone={TONES[i % TONES.length]}/>
                      <div className="min-w-0">
                        <div className="font-bold whitespace-nowrap overflow-hidden text-ellipsis">{d.nombre}</div>
                        <div className="t-mute text-[11px] mt-[2px] whitespace-nowrap overflow-hidden text-ellipsis">{d.descripcion || 'Sin descripción'}</div>
                      </div>
                    </div>
                    <div className="drops-history-status"><span className={s.badge}>{d.estado === 'activo' && <span className="dot"/>}{s.label}</span></div>
                    <div className="drops-history-date t-mute">{fmtFecha(d.estado === 'cerrado' ? d.cierra_at ?? d.inicia_at : d.inicia_at)}</div>
                    <div className="drops-history-stat mono tnum" data-label="Unidades">{r.total}</div>
                    <div className="drops-history-stat mono tnum" data-label="Vendidas">{r.vendidas || d.vendidas_count || 0}</div>
                    <div className="drops-history-stat mono tnum" data-label="Sin vender">{r.sinVender}</div>
                    <div className="drops-history-stat mono tnum" data-label="Viewers">{(d.viewers_count ?? 0).toLocaleString()}</div>
                    <div className="drops-history-revenue mono tnum font-bold">{dinero(d.recaudado_total)}</div>
                    <div className="drops-history-menu" onClick={e => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="btn-ghost h-7 flex items-center justify-center">
                            <Icons.more width={13} height={13} className="text-[var(--ink-3)]"/>
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => router.push(`/drops/${d.id}`)}>
                            <Icons.eye width={14} height={14}/> Ver detalle
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => copiarLink(d.id)}>
                            <Icons.share width={14} height={14}/> Copiar link
                          </DropdownMenuItem>
                          {d.estado === 'programado' && (
                            <DropdownMenuItem onSelect={() => activarDrop(d.id)}>
                              <Icons.sparkle width={14} height={14}/> Activar ahora
                            </DropdownMenuItem>
                          )}
                          {d.estado === 'activo' && (
                            <DropdownMenuItem onSelect={() => cerrarDrop(d.id)}>
                              <Icons.clock width={14} height={14}/> Cerrar drop
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator/>
                          <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDeleteDrop(d.id)}>
                            <Icons.trash width={14} height={14}/> Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      {confirmDeleteDrop && (
        <ConfirmModal
          title="Eliminar drop"
          description="Se eliminará el drop y perderás todo su historial. Las prendas asociadas quedarán sin drop asignado."
          confirmLabel="Sí, eliminar"
          variant="danger"
          loading={deletePending}
          onConfirm={() => startDeleteTransition(() => eliminarDrop(confirmDeleteDrop))}
          onClose={() => setConfirmDeleteDrop(null)}
        />
      )}
    </div>
  );
}
