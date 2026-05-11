'use client';

import Image from 'next/image';

import { cld } from '@/lib/cloudinary/client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Icons } from '@/components/shared/icons';
import { PublicProductCard } from '@/components/shared/public-product-card';
import { PhoneInput } from '@/components/shared/phone-input';
import { useCountdown, pad } from '@/hooks/use-countdown';
import { useDropViewerCount } from '@/hooks/use-drop-viewer-count';
import { useCarrito } from '@/hooks/use-carrito';
import { getAvailableProductSizes, getProductTotalQuantity } from '@/lib/product-sizes';
import type { Tienda } from '@/types/tienda';
import type { Prenda } from '@/types/prenda';
import type { Drop } from '@/types/drop';
import type { Actividad } from '@/types/drop';
import type { MetodoPago, MetodoEnvio } from '@/types/envio';

function formatRelativo(iso: string | null) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `hace ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  return `hace ${h}h`;
}

function formatDropDate(value: string | null) {
  if (!value) return 'Fecha por anunciar';
  return new Intl.DateTimeFormat('es-HN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function CountdownInline({ target }: { target: number; urgent: boolean }) {
  const { d, h, m, s, ready } = useCountdown(target);
  return (
    <span className="mono tnum font-bold tracking-[0]">
      {ready ? `${d > 0 ? `${d}d ` : ''}${pad(h)}:${pad(m)}:${pad(s)}` : '--:--:--'}
    </span>
  );
}

export function DropPageClient({
  tienda, drop, prendas: prendasInit,
  actividad: actividadInit, anotadasCount,
}: {
  tienda: Tienda; drop: Drop; prendas: Prenda[];
  metodosPago: MetodoPago[]; metodosEnvio: MetodoEnvio[];
  actividad: Actividad[]; anotadasCount: number;
}) {
  const router = useRouter();
  const [prendas, setPrendas] = useState<Prenda[]>(prendasInit);
  const [actividadLive, setActividadLive] = useState<Actividad[]>(actividadInit);
  const [dropEstado, setDropEstado] = useState(drop.estado);
  const [heroImageFailedFor, setHeroImageFailedFor] = useState<string | null>(null);
  const [previewNoticeOpen, setPreviewNoticeOpen] = useState(false);
  const [, setTick] = useState(0);
  const supabaseRef = useRef(createClient());
  const esActivo = dropEstado === 'activo';
  const esProgramado = dropEstado === 'programado';
  const viewers = useDropViewerCount(drop.id, {
    initialCount: drop.viewers_count,
    trackSelf: esActivo,
  });
  const { agregarItem, tieneItem, abrirDrawer, count: carritoCount } = useCarrito();

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 10000);
    return () => clearInterval(t);
  }, []);

  // Real-time estado del drop
  useEffect(() => {
    const sb = supabaseRef.current;
    const ch = sb.channel(`drop-estado-${drop.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'drops', filter: `id=eq.${drop.id}` },
        (payload) => {
          const nuevo = (payload.new as { estado?: string }).estado;
          if (nuevo) setDropEstado(nuevo);
        })
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [drop.id]);

  // Real-time actividad
  useEffect(() => {
    const sb = supabaseRef.current;
    const ch = sb.channel(`actividad-${drop.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'actividad', filter: `drop_id=eq.${drop.id}` },
        (payload) => setActividadLive(prev => [payload.new as Actividad, ...prev].slice(0, 20)))
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [drop.id]);

  // Real-time prendas estado
  useEffect(() => {
    const sb = supabaseRef.current;
    const ch = sb.channel(`prendas-drop-${drop.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'prendas', filter: `drop_id=eq.${drop.id}` },
        (payload) => setPrendas(prev => prev.map(p => p.id === (payload.new as Prenda).id ? { ...p, ...(payload.new as Prenda) } : p)))
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [drop.id]);

  const dropTarget = drop.cierra_at
    ? new Date(drop.cierra_at).getTime()
    : new Date(drop.inicia_at).getTime() + drop.duracion_minutos * 60000;

  const isPreview = !esActivo;
  const prendasDisponibles = prendas
    .filter(p => p.estado === 'disponible')
    .reduce((sum, p) => sum + getProductTotalQuantity(p), 0);
  const prendasTotales = prendas.reduce((sum, p) => sum + getProductTotalQuantity(p), 0);
  const showHeroImage = Boolean(drop.foto_portada_url && heroImageFailedFor !== drop.foto_portada_url);

  const handleShare = () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: drop.nombre, url }).catch(() => undefined);
    } else {
      navigator.clipboard.writeText(url);
    }
  };

  const irCatalogo = () => router.push(`/${tienda.username}#catalogo`);

  const irAviso = () => {
    setPreviewNoticeOpen(false);
    window.setTimeout(() => {
      document.getElementById('drop-aviso')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  };

  return (
    <div className="min-h-screen bg-[#f5f4f2]">

      {/* ── STICKY HEADER ── */}
      <nav className="sticky top-0 z-50 bg-[rgba(255,255,255,0.96)] backdrop-blur-[16px] border-b border-[rgba(0,0,0,0.08)] px-4 h-[52px] flex items-center gap-[10px]">
        <button
          onClick={() => router.push(`/${tienda.username}`)}
          className="w-8 h-8 rounded-full bg-[#f0efed] border-none cursor-pointer flex items-center justify-center shrink-0"
        >
          <Icons.back width={15} height={15} />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-[6px]">
            {esActivo && (
              <span className="inline-flex items-center gap-1 bg-[#ef4444] rounded-[20px] px-[7px] py-[1px] text-[9px] font-bold text-white tracking-[0.08em] shrink-0">
                <span className="w-1 h-1 rounded-full bg-white [animation:pulse_1.4s_ease-in-out_infinite] inline-block" />
                EN VIVO
              </span>
            )}
            <span className="text-[13px] font-semibold whitespace-nowrap overflow-hidden text-ellipsis">
              {drop.nombre}
            </span>
          </div>
          <div className="text-[11px] text-[#888] flex items-center gap-1">
            {esActivo ? 'Cierra en' : 'Abre en'}
            <span className={esActivo ? 'text-[#ef4444]' : 'text-[#666]'}>
              <CountdownInline target={dropTarget} urgent={esActivo} />
            </span>
          </div>
        </div>

        <button
          onClick={handleShare}
          className="w-8 h-8 rounded-full bg-[#f0efed] border-none cursor-pointer flex items-center justify-center shrink-0"
          title="Compartir drop"
        >
          <Icons.share width={15} height={15} />
        </button>

        <button
          onClick={abrirDrawer}
          className={`relative w-8 h-8 rounded-full border-none cursor-pointer flex items-center justify-center shrink-0 ${carritoCount > 0 ? 'bg-[var(--accent-3)] text-white' : 'bg-[#f0efed] text-[var(--accent-3)]'}`}
          title="Ver carrito"
        >
          <Icons.bag width={15} height={15} />
          {carritoCount > 0 && (
            <span className="absolute top-[-4px] right-[-4px] w-[18px] h-[18px] rounded-[9px] bg-[#111] text-white text-[10px] font-extrabold flex items-center justify-center border-2 border-white">
              {carritoCount}
            </span>
          )}
        </button>
      </nav>

      {/* ── DROP SUMMARY ── */}
      <section className="px-[14px] pt-[18px]">
        <div className="max-w-[1100px] mx-auto bg-[var(--dark)] border border-[rgba(255,255,255,0.10)] rounded-[8px] overflow-hidden grid shadow-[0_22px_60px_rgba(26,23,20,0.22)] grid-cols-1 md:grid-cols-[repeat(auto-fit,minmax(300px,1fr))]">
          <div className="relative min-h-[240px] max-h-[360px] bg-[var(--dark-2)] overflow-hidden">
            {showHeroImage ? (
              <Image
                src={cld(drop.foto_portada_url, 'cover')}
                alt={drop.nombre}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover block"
                onError={() => setHeroImageFailedFor(drop.foto_portada_url)}
              />
            ) : (
              <div className="absolute inset-0 bg-[linear-gradient(145deg,var(--dark-2)_0%,var(--dark-3)_55%,var(--dark)_100%),repeating-linear-gradient(-45deg,transparent,transparent_18px,rgba(255,255,255,0.035)_18px,rgba(255,255,255,0.035)_19px)]" />
            )}
            <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.04),rgba(0,0,0,0.74))]" />
            <div className="absolute left-[18px] right-[18px] bottom-[18px] flex items-center justify-between gap-3">
              <span className={`inline-flex items-center gap-[6px] border border-[rgba(255,255,255,0.18)] text-white rounded-[20px] px-3 py-[6px] text-[10px] font-extrabold tracking-[0.08em] ${esActivo ? 'bg-[#ef4444]' : 'bg-[rgba(255,255,255,0.14)]'}`}>
                {esActivo && <span className="w-[5px] h-[5px] rounded-full bg-white [animation:pulse_1.4s_ease-in-out_infinite] inline-block" />}
                {esActivo ? 'EN VIVO' : 'PROGRAMADO'}
              </span>
              <span className="text-[rgba(255,255,255,0.76)] text-[12px] font-bold">
                {formatDropDate(drop.inicia_at)}
              </span>
            </div>
          </div>

          <div className="px-6 pt-6 pb-[22px] flex flex-col justify-between gap-[22px]">
            <div>
              <div className="text-[11px] text-[rgba(255,255,255,0.48)] font-extrabold tracking-[0.1em] uppercase mb-2">
                {tienda.nombre}
              </div>
              <h1 className="text-[34px] leading-[1.02] font-black text-white tracking-[0] m-0 mb-3 break-words">
                {drop.nombre}
              </h1>

              <div className="flex gap-2 flex-wrap">
                <span className="inline-flex items-center gap-[6px] bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.12)] text-[rgba(255,255,255,0.78)] rounded-[20px] px-[11px] py-[6px] text-[12px] font-bold">
                  <Icons.box width={13} height={13} />
                  {prendasTotales} unidades
                </span>
                <span className="inline-flex items-center gap-[6px] bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.12)] text-[rgba(255,255,255,0.78)] rounded-[20px] px-[11px] py-[6px] text-[12px] font-bold">
                  <Icons.eye width={13} height={13} />
                  {viewers} viendo
                </span>
                {anotadasCount > 0 && (
                  <span className="inline-flex items-center gap-[6px] bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.12)] text-[rgba(255,255,255,0.78)] rounded-[20px] px-[11px] py-[6px] text-[12px] font-bold">
                    <Icons.bell width={13} height={13} />
                    {anotadasCount} anotadas
                  </span>
                )}
              </div>
            </div>

            <div className="grid gap-4 items-end grid-cols-[1fr_auto]">
              <div>
                <div className="text-[10px] text-[rgba(255,255,255,0.46)] uppercase tracking-[0.1em] font-[var(--font-mono)] mb-[5px]">
                  {esActivo ? 'Cierra en' : 'Abre en'}
                </div>
                <div className="text-white text-[28px] tracking-[0]">
                  <CountdownInline target={dropTarget} urgent={esActivo} />
                </div>
              </div>
              <button
                onClick={() => {
                  if (esActivo) document.getElementById('drop-prendas')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  else if (esProgramado) document.getElementById('drop-aviso')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  else irCatalogo();
                }}
                className={`h-11 rounded-[8px] border border-[rgba(255,255,255,0.22)] px-[15px] text-[13px] font-extrabold cursor-pointer whitespace-nowrap ${esActivo ? 'bg-white text-[#111]' : 'bg-[rgba(255,255,255,0.1)] text-white'}`}
              >
                {esActivo ? 'Ver prendas' : esProgramado ? 'Avisarme' : 'Ver catálogo'}
              </button>
            </div>
          </div>
        </div>
      </section>


      {/* ── MAIN ── */}
      <div id="drop-prendas" className="max-w-[1100px] mx-auto px-[14px] pt-[18px] pb-[80px]">

        {/* Stats bar */}
        <div className="flex items-center justify-between mb-[14px]">
          <div className="text-[13px] text-[#666]">
            {prendasDisponibles > 0
              ? <><span className="text-[#16a34a] font-bold">{prendasDisponibles}</span> disponibles de {prendasTotales}</>
              : <span className="text-[#888]">Sin prendas disponibles</span>}
          </div>
        </div>

        {/* ── LAYOUT: grid + actividad side-by-side when active ── */}
        <div className={`drop-layout-grid${esActivo ? ' drop-layout-active' : ''}`}>
          {/* ── GRID PRENDAS ── */}
          <div>
            {prendas.length === 0 ? (
              <div className="text-center px-[16px] py-[42px] text-[#999] text-[14px] bg-white border border-[rgba(0,0,0,0.07)] rounded-[8px]">
                <div className="text-[15px] font-extrabold text-[#222] mb-[4px]">Todavía no hay prendas publicadas</div>
                <div>Cuando la tienda agregue prendas, aparecerán aquí.</div>
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-[12px]">
                {prendas.map((p, i) => {
                  const disponible = p.estado === 'disponible';
                  const availableSizes = getAvailableProductSizes(p);
                  const tieneVariantes = availableSizes.length > 1;
                  const tallaCarrito = availableSizes[0] ?? null;
                  const enCarrito = tieneItem(p.id, tallaCarrito);
                  const href = `/${tienda.username}/drop/${drop.id}/prenda/${p.id}`;
                  const openCard = () => {
                    if (esActivo) {
                      router.push(href);
                    } else {
                      setPreviewNoticeOpen(true);
                    }
                  };

                  return (
                    <PublicProductCard
                      key={p.id}
                      product={p}
                      tone={(['rose', 'sand', 'sage', 'blue', 'dark', 'warm', 'neutral'] as const)[i % 7]}
                      isPreview={isPreview}
                      showActions={esActivo}
                      cartActive={!tieneVariantes && enCarrito}
                      cartTitle={tieneVariantes ? 'Elegir talla' : enCarrito ? 'Ver carrito' : 'Añadir al carrito'}
                      onOpen={openCard}
                      onBuy={() => router.push(href)}
                      onCart={() => {
                        if (tieneVariantes) {
                          router.push(href);
                        } else if (enCarrito) {
                          abrirDrawer();
                        } else {
                          agregarItem({
                            prendaId: p.id,
                            nombre: p.nombre,
                            marca: p.marca ?? null,
                            talla: tallaCarrito,
                            precio: p.precio,
                            foto: p.fotos?.[0] ?? null,
                            tiendaUsername: tienda.username,
                            tiendaId: tienda.id,
                          });
                        }
                      }}
                    />
                  );
                })}
              </div>
            )}

            {esProgramado && <AnotarseSection dropId={drop.id} />}
          </div>

          {/* ── ACTIVIDAD EN VIVO ── */}
          {esActivo && (
            <div className="drop-activity-sidebar sticky top-[68px] max-h-[calc(100vh-84px)] min-h-0">
              <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.07)] overflow-hidden max-h-[calc(100vh-84px)] flex flex-col">
                <div className="px-[14px] py-[12px] border-b border-[rgba(0,0,0,0.07)] flex items-center justify-between shrink-0">
                  <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#999] flex items-center gap-[6px]">
                    <span className="w-[6px] h-[6px] rounded-[3px] bg-[#ef4444] inline-block [animation:pulse_1.4s_ease-in-out_infinite]" />
                    Actividad en vivo
                  </div>
                  <span className="text-[11px] text-[#aaa] flex items-center gap-[4px]">
                    <Icons.eye width={11} height={11} />
                    {viewers}
                  </span>
                </div>

                {actividadLive.length === 0 ? (
                  <div className="px-[16px] py-[28px] text-center">
                    <div className="w-[36px] h-[36px] rounded-[18px] bg-[#f5f5f5] flex items-center justify-center mx-auto mb-[10px]">
                      <Icons.eye width={16} height={16} className="text-[#bbb]" />
                    </div>
                    <div className="text-[12px] font-semibold text-[#333] mb-[4px]">Esperando actividad</div>
                    <div className="text-[11px] text-[#bbb] leading-[1.5]">Las compras y apartados aparecerán aquí en tiempo real.</div>
                  </div>
                ) : (
                  <div className="px-[14px] pt-[10px] pb-[14px] grid gap-[14px] overflow-y-auto min-h-0">
                    {actividadLive.map(a => {
                      const partes = a.texto.split('·').map(s => s.trim());
                      const nombre = partes[0] ?? '';
                      const prenda = partes[1] ?? '';
                      const talla = partes[2] ?? '';
                      const esCompra = a.tipo === 'compra';
                      const esApartado = a.tipo === 'apartado';
                      const letraAvatar = nombre.charAt(0).toUpperCase();

                      return (
                        <div key={a.id} className="flex gap-[12px] items-start">
                          <div
                            className="w-[36px] h-[36px] rounded-[18px] shrink-0 flex items-center justify-center text-[13px] font-bold"
                            style={{
                              background: esCompra ? '#0a0a0a' : esApartado ? '#fef3c7' : '#f0efed',
                              color: esCompra ? '#fff' : esApartado ? '#92400e' : '#888',
                            }}
                          >
                            {letraAvatar}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[14px] leading-[1.4]">
                              <span className="font-bold">{nombre}</span>
                              {esApartado && <span className="text-[#d97706] font-medium"> apartó</span>}
                              {esCompra && <span className="text-[#555] font-medium"> compró</span>}
                            </div>
                            {prenda && (
                              <div className="text-[13px] font-semibold text-[#222] mt-[2px]">
                                {prenda}{talla && <span className="text-[#999] font-normal"> · {talla}</span>}
                              </div>
                            )}
                            <div className="mono text-[10px] text-[#bbb] mt-[3px]">{formatRelativo(a.created_at)}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {previewNoticeOpen && (
        <PreviewDropNotice
          dropName={drop.nombre}
          onClose={() => setPreviewNoticeOpen(false)}
          onAviso={irAviso}
          onCatalogo={irCatalogo}
        />
      )}
    </div>
  );
}

function PreviewDropNotice({ dropName, onClose, onAviso, onCatalogo }: {
  dropName: string;
  onClose: () => void;
  onAviso: () => void;
  onCatalogo: () => void;
}) {
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[120] bg-[rgba(0,0,0,0.42)] flex items-center justify-center p-[18px] backdrop-blur-[6px]"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-[min(430px,100%)] bg-white rounded-[12px] border border-[rgba(0,0,0,0.08)] shadow-[0_24px_80px_rgba(0,0,0,0.22)] p-[22px]"
      >
        <div className="flex justify-between gap-[14px] items-start mb-[12px]">
          <div>
            <div className="text-[12px] font-extrabold tracking-[0.08em] uppercase text-[#999] mb-[7px]">Preview del drop</div>
            <div className="text-[22px] leading-[1.08] font-black text-[#111]">
              {dropName} todavía no abre
            </div>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="w-[32px] h-[32px] rounded-[16px] border border-[rgba(0,0,0,0.08)] bg-[#f5f5f5] flex items-center justify-center cursor-pointer shrink-0">
            <Icons.close width={16} height={16} />
          </button>
        </div>
        <p className="m-0 mb-[18px] text-[14px] text-[#666] leading-[1.55]">
          Estas prendas se pueden ver, pero la compra se activa hasta que el drop esté en vivo.
        </p>
        <div className="grid grid-cols-2 gap-[8px]">
          <button onClick={onCatalogo} className="btn btn-outline h-[44px] rounded-[8px]">
            Ver catálogo
          </button>
          <button onClick={onAviso} className="btn btn-primary h-[44px] rounded-[8px]">
            Avisarme
          </button>
        </div>
      </div>
    </div>
  );
}

function AnotarseSection({ dropId }: { dropId: string }) {
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  async function handleAnotarse() {
    if (!telefono.trim()) { setError('Ingresá tu número de WhatsApp.'); return; }
    setLoading(true); setError('');
    const supabase = createClient();
    const { error: err } = await supabase.from('anotaciones').insert({
      drop_id: dropId,
      telefono: telefono.trim(),
      email: email.trim() || null,
    } as any);
    if (err) { setError('No pudimos registrarte. Intentá de nuevo.'); setLoading(false); return; }
    setDone(true);
    setLoading(false);
  }

  if (done) {
    return (
      <div id="drop-aviso" className="mt-[20px] mb-[16px] bg-white rounded-[8px] border border-[rgba(0,0,0,0.07)] px-[20px] py-[28px] text-center">
        <div className="w-[52px] h-[52px] rounded-[26px] bg-[#ecfdf5] flex items-center justify-center text-[22px] mx-auto mb-[14px]">✓</div>
        <div className="text-[16px] font-bold mb-[6px]">¡Listo, te anotaste!</div>
        <div className="text-[13px] text-[#888] leading-[1.6]">
          Te avisamos por WhatsApp 15 min antes de que abra el drop.
        </div>
      </div>
    );
  }

  return (
    <div id="drop-aviso" className="mt-[20px] mb-[16px] bg-white rounded-[8px] border border-[rgba(0,0,0,0.07)] px-[20px] py-[22px]">
      <div className="text-[16px] font-bold mb-[4px]">
        ¿Querés que te avisemos?
      </div>
      <div className="text-[13px] text-[#888] mb-[20px] leading-[1.55]">
        Te mandamos un WhatsApp 15 min antes de que abra el drop.
      </div>
      <div className="mb-[10px]">
        <label className="label">WhatsApp</label>
        <PhoneInput value={telefono} onChange={v => { setTelefono(v); setError(''); }} />
      </div>
      <div className="mb-[18px]">
        <label className="label">
          Email <span className="font-normal text-[#bbb]">(opcional)</span>
        </label>
        <input
          className="input"
          type="email"
          placeholder="karla@gmail.com"
          value={email}
          onChange={e => { setEmail(e.target.value); setError(''); }}
        />
      </div>
      {error && <div className="text-[13px] text-[#dc2626] mb-[12px] px-[14px] py-[10px] bg-[#fef2f2] rounded-[8px]">{error}</div>}
      <button className="btn btn-primary btn-block h-[48px]" onClick={handleAnotarse} disabled={loading}>
        {loading ? 'Registrando...' : 'Anotarme'}
      </button>
    </div>
  );
}
