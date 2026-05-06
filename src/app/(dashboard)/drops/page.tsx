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
    <div style={{ width: 44, height: 44, borderRadius: 8, overflow: 'hidden', background: 'var(--surface-2)', flexShrink: 0 }}>
      {drop.foto_portada_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img loading="lazy" src={drop.foto_portada_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}/>
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
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div className="mono t-mute" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0 }}>{label}</div>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-2)' }}>
          <Icon width={14} height={14}/>
        </div>
      </div>
      <div className="tnum" style={{ fontSize: 27, fontWeight: 700, marginTop: 8 }}>{value}</div>
      <div className="t-mute" style={{ fontSize: 12, marginTop: 3 }}>{help}</div>
    </div>
  );
}

function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div style={{ padding: '38px 16px', textAlign: 'center' }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', color: 'var(--ink-3)' }}>
        <Icons.sparkle width={18} height={18}/>
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 5 }}>{title}</div>
      <div className="t-mute" style={{ fontSize: 13, marginBottom: action ? 16 : 0 }}>{body}</div>
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
    <div className="drops-page-shell" style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="drops-page-header" style={{ padding: '20px 28px 16px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>Drops</div>
          <div className="t-mute" style={{ fontSize: 13, marginTop: 3 }}>
            {loading ? 'Cargando drops...' : `${stats.activos} en vivo · ${stats.programados} programados · ${stats.cerrados} cerrados`}
          </div>
        </div>
        <div className="drops-header-actions" style={{ display: 'flex', gap: 8 }}>
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

      <div className="drops-page-content" style={{ flex: 1, overflowY: 'auto', padding: '20px 28px 28px' }}>
        <div className="drops-metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, marginBottom: 20 }}>
          <MetricCard label="Drops activos" value={String(stats.activos)} help={`${stats.programados} programados en cola`} icon={Icons.sparkle}/>
          <MetricCard label="Cerrados" value={String(stats.cerrados)} help={`${dinero(stats.totalCerrado)} recaudados`} icon={Icons.check}/>
          <MetricCard label="Unidades vendidas" value={String(stats.vendidas)} help={`${stats.apartadas} apartadas pendientes`} icon={Icons.bag}/>
          <MetricCard label="Comprobantes" value={String(comprobantesPendientes)} help="Pagos por verificar" icon={Icons.inbox}/>
        </div>

        <div className="drops-overview-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(360px, 1.05fr) minmax(420px, 1.35fr)', gap: 20, alignItems: 'start', marginBottom: 24 }}>
          <section>
            <div className="drops-section-heading" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>En curso y próximos</div>
              <button onClick={() => router.push('/drops/nuevo')} className="btn btn-outline btn-sm">
                <Icons.plus width={12} height={12}/> Crear
              </button>
            </div>
            <div className="card" style={{ overflow: 'hidden' }}>
              {loading ? (
                <div style={{ padding: 24, color: 'var(--ink-3)', fontSize: 13, textAlign: 'center' }}>Cargando...</div>
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
                      className="drops-active-row"
                      style={{ padding: '14px 16px', borderBottom: i < activos.length - 1 ? '1px solid var(--line)' : 'none', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                    >
                      <DropThumb drop={d} tone={TONES[i % TONES.length]}/>
                      <div className="drops-active-copy" style={{ flex: 1, minWidth: 0 }}>
                        <div className="drops-active-title-row" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.nombre}</div>
                          <span className={s.badge}>{d.estado === 'activo' && <span className="dot"/>}{s.label}</span>
                        </div>
                        <div className="t-mute" style={{ fontSize: 12, marginTop: 3 }}>
                          {resumen.total} unidades · {resumen.vendidas || d.vendidas_count || 0} vendidas · {dinero(d.recaudado_total)}
                        </div>
                      </div>
                      <div className="drops-active-countdown mono tnum" style={{ fontSize: 12, color: s.tone, minWidth: 78, textAlign: 'right' }}>
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
            <div className="drops-section-heading" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Resumen de drop cerrado</div>
              {cerrados.length > 0 && (
                <select className="drops-closed-select input" style={{ width: 220, height: 32, fontSize: 12 }} value={cerradoSeleccionado?.id ?? ''} onChange={e => setDropCerradoId(e.target.value)}>
                  {cerrados.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                </select>
              )}
            </div>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {loading ? (
                <div style={{ padding: 24, color: 'var(--ink-3)', fontSize: 13, textAlign: 'center' }}>Cargando resumen...</div>
              ) : !cerradoSeleccionado ? (
                <EmptyState title="Todavía no hay drops cerrados" body="Cuando cierres un drop, su recaudación, remanentes y apartados aparecerán aquí."/>
              ) : (
                <>
                  <div className="drops-closed-summary" style={{ padding: 22, display: 'grid', gridTemplateColumns: '72px 1fr auto', gap: 16, alignItems: 'center' }}>
                    <div style={{ width: 72, height: 90, borderRadius: 10, overflow: 'hidden', background: 'var(--surface-2)' }}>
                      {cerradoSeleccionado.foto_portada_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img loading="lazy" src={cerradoSeleccionado.foto_portada_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}/>
                      ) : <Ph tone="sand" aspect="4/5" radius={10}/>}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span className="badge badge-sold">Cerrado</span>
                        <span className="t-mute" style={{ fontSize: 12 }}>{fmtFecha(cerradoSeleccionado.cierra_at ?? cerradoSeleccionado.inicia_at)}</span>
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cerradoSeleccionado.nombre}</div>
                      <div className="t-mute" style={{ fontSize: 12, marginTop: 2 }}>{resumenSeleccionado.total} unidades publicadas</div>
                    </div>
                    <div className="drops-closed-total" style={{ textAlign: 'right' }}>
                      <div className="mono t-mute" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0 }}>Total recaudado</div>
                      <div className="tnum" style={{ fontSize: 34, lineHeight: 1.05, fontWeight: 800 }}>{dinero(cerradoSeleccionado.recaudado_total)}</div>
                      {resumenSeleccionado.valorApartado > 0 && (
                        <div className="t-mute" style={{ fontSize: 12, marginTop: 4 }}>+ {dinero(resumenSeleccionado.valorApartado)} pendientes</div>
                      )}
                    </div>
                  </div>

                  <div className="drops-closed-stats" style={{ borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)', padding: '14px 18px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                    {[
                      ['Vendidas', resumenSeleccionado.vendidas || cerradoSeleccionado.vendidas_count || 0],
                      ['Apartadas', resumenSeleccionado.apartadas],
                      ['Sin vender', resumenSeleccionado.sinVender],
                      ['Viewers', cerradoSeleccionado.viewers_count ?? 0],
                    ].map(([label, value]) => (
                      <div key={label} style={{ textAlign: 'center' }}>
                        <div className="tnum" style={{ fontSize: 22, fontWeight: 700 }}>{value}</div>
                        <div className="t-mute" style={{ fontSize: 11 }}>{label}</div>
                      </div>
                    ))}
                  </div>

                  <div className="drops-closed-actions" style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                    <button onClick={() => router.push('/pedidos')} className="btn btn-outline" style={{ height: 46 }}>
                      <Icons.bag width={14} height={14}/> Ver pedidos
                    </button>
                    <button onClick={() => router.push('/comprobantes')} className="btn btn-outline" style={{ height: 46 }}>
                      <Icons.inbox width={14} height={14}/> Verificar
                    </button>
                    <button onClick={() => router.push(`/drops/${cerradoSeleccionado.id}`)} className="btn btn-primary" style={{ height: 46 }}>
                      Ver detalle <Icons.arrow width={14} height={14}/>
                    </button>
                  </div>
                </>
              )}
            </div>
          </section>
        </div>

        <section>
          <div className="drops-history-toolbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Historial de drops</div>
              <div className="t-mute" style={{ fontSize: 12, marginTop: 2 }}>Todos tus lanzamientos con estado, resultados y acciones.</div>
            </div>
            <div className="drops-history-controls" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="drops-history-search" style={{ position: 'relative', width: 260 }}>
                <Icons.search width={14} height={14} style={{ position: 'absolute', left: 11, top: 9, color: 'var(--ink-3)' }}/>
                <input
                  className="input"
                  style={{ height: 34, paddingLeft: 32, fontSize: 12 }}
                  placeholder="Buscar drop..."
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                />
              </div>
              <div className="drops-filter-row" style={{ display: 'flex', gap: 4 }}>
                {filtros.map(f => (
                  <button
                    key={f.id}
                    onClick={() => setFiltro(f.id)}
                    style={{
                      height: 34,
                      padding: '0 10px',
                      borderRadius: 8,
                      background: filtro === f.id ? 'var(--ink)' : '#fff',
                      color: filtro === f.id ? '#fff' : 'var(--ink-3)',
                      border: `1px solid ${filtro === f.id ? 'var(--ink)' : 'var(--line)'}`,
                      fontSize: 12,
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    {f.label}
                    <span className="mono tnum" style={{ opacity: 0.7 }}>{f.count}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="drops-history-card card" style={{ overflow: 'hidden' }}>
            <div className="drops-history-head mono" style={{ display: 'grid', gridTemplateColumns: '2fr 120px 130px 90px 90px 90px 110px 130px 34px', padding: '10px 16px', borderBottom: '1px solid var(--line)', fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: 0 }}>
              <div>Drop</div><div>Estado</div><div>Fecha</div><div>Unidades</div><div>Vendidas</div><div>Sin vender</div><div>Viewers</div><div>Recaudado</div><div/>
            </div>
            {loading ? (
              <div style={{ padding: 32, color: 'var(--ink-3)', fontSize: 13, textAlign: 'center' }}>Cargando historial...</div>
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
                    className="drops-history-row"
                    style={{ display: 'grid', gridTemplateColumns: '2fr 120px 130px 90px 90px 90px 110px 130px 34px', padding: '12px 16px', borderBottom: i < historial.length - 1 ? '1px solid var(--line-2)' : 'none', alignItems: 'center', fontSize: 12, cursor: 'pointer' }}
                  >
                    <div className="drops-history-main" style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                      <DropThumb drop={d} tone={TONES[i % TONES.length]}/>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.nombre}</div>
                        <div className="t-mute" style={{ fontSize: 11, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.descripcion || 'Sin descripción'}</div>
                      </div>
                    </div>
                    <div className="drops-history-status"><span className={s.badge}>{d.estado === 'activo' && <span className="dot"/>}{s.label}</span></div>
                    <div className="drops-history-date t-mute">{fmtFecha(d.estado === 'cerrado' ? d.cierra_at ?? d.inicia_at : d.inicia_at)}</div>
                    <div className="drops-history-stat mono tnum" data-label="Unidades">{r.total}</div>
                    <div className="drops-history-stat mono tnum" data-label="Vendidas">{r.vendidas || d.vendidas_count || 0}</div>
                    <div className="drops-history-stat mono tnum" data-label="Sin vender">{r.sinVender}</div>
                    <div className="drops-history-stat mono tnum" data-label="Viewers">{(d.viewers_count ?? 0).toLocaleString()}</div>
                    <div className="drops-history-revenue mono tnum" style={{ fontWeight: 700 }}>{dinero(d.recaudado_total)}</div>
                    <div className="drops-history-menu" onClick={e => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="btn-ghost" style={{ height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Icons.more width={13} height={13} style={{ color: 'var(--ink-3)' }}/>
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
