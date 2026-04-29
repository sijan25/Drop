'use client';

import Image from 'next/image';

import { cld } from '@/lib/cloudinary/client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Icons } from '@/components/shared/icons';
import { PhoneInput } from '@/components/shared/phone-input';
import { useCountdown, pad } from '@/hooks/use-countdown';
import { useDropViewerCount } from '@/hooks/use-drop-viewer-count';
import { Ph } from '@/components/shared/image-placeholder';
import { getProductSizes, getProductSizeQuantities, getProductTotalQuantity } from '@/lib/product-sizes';
import type { Database } from '@/types/database';

type Tienda = Database['public']['Tables']['tiendas']['Row'];
type Drop = Database['public']['Tables']['drops']['Row'];
type Prenda = Database['public']['Tables']['prendas']['Row'];
type MetodoPago = Database['public']['Tables']['metodos_pago']['Row'];
type MetodoEnvio = Database['public']['Tables']['metodos_envio']['Row'];
type Actividad = Database['public']['Tables']['actividad']['Row'];

type Tone = 'rose' | 'sand' | 'sage' | 'blue' | 'dark' | 'neutral' | 'warm';
const TONES: Tone[] = ['rose', 'sand', 'sage', 'blue', 'dark', 'warm', 'neutral'];

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
    <span className="mono tnum" style={{ fontWeight: 700, letterSpacing: 0 }}>
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
    document.getElementById('drop-aviso')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f5f4f2' }}>

      {/* ── STICKY HEADER ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(255,255,255,0.96)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(0,0,0,0.08)',
        padding: '0 16px', height: 52,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <button
          onClick={() => router.push(`/${tienda.username}`)}
          style={{ width: 32, height: 32, borderRadius: 16, background: '#f0efed', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
        >
          <Icons.back width={15} height={15} />
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {esActivo && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                background: '#ef4444', borderRadius: 20, padding: '1px 7px',
                fontSize: 9, fontWeight: 700, color: '#fff', letterSpacing: '0.08em',
                flexShrink: 0,
              }}>
                <span style={{ width: 4, height: 4, borderRadius: 2, background: '#fff', animation: 'pulse 1.4s ease-in-out infinite', display: 'inline-block' }} />
                EN VIVO
              </span>
            )}
            <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {drop.nombre}
            </span>
          </div>
          <div style={{ fontSize: 11, color: '#888', display: 'flex', alignItems: 'center', gap: 4 }}>
            {esActivo ? 'Cierra en' : 'Abre en'}
            <span style={{ color: esActivo ? '#ef4444' : '#666' }}>
              <CountdownInline target={dropTarget} urgent={esActivo} />
            </span>
          </div>
        </div>

        <button
          onClick={handleShare}
          style={{ width: 32, height: 32, borderRadius: 16, background: '#f0efed', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
        >
          <Icons.share width={15} height={15} />
        </button>
      </nav>

      {/* ── DROP SUMMARY ── */}
      <section style={{ padding: '18px 14px 0' }}>
        <div style={{
          maxWidth: 1100,
          margin: '0 auto',
          background: 'var(--dark)',
          border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: 8,
          overflow: 'hidden',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          boxShadow: '0 22px 60px rgba(26,23,20,0.22)',
        }}>
          <div style={{
            position: 'relative',
            minHeight: 240,
            maxHeight: 360,
            aspectRatio: '16/10',
            background: 'var(--dark-2)',
            overflow: 'hidden',
          }}>
            {showHeroImage ? (
              <Image
                src={cld(drop.foto_portada_url, 'cover')}
                alt={drop.nombre}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                style={{ objectFit: 'cover', display: 'block' }}
                onError={() => setHeroImageFailedFor(drop.foto_portada_url)}
              />
            ) : (
              <div style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: 'linear-gradient(145deg, var(--dark-2) 0%, var(--dark-3) 55%, var(--dark) 100%), repeating-linear-gradient(-45deg, transparent, transparent 18px, rgba(255,255,255,0.035) 18px, rgba(255,255,255,0.035) 19px)',
              }} />
            )}
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.04), rgba(0,0,0,0.74))' }} />
            <div style={{ position: 'absolute', left: 18, right: 18, bottom: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: esActivo ? '#ef4444' : 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.18)', color: '#fff', borderRadius: 20, padding: '6px 12px', fontSize: 10, fontWeight: 800, letterSpacing: '0.08em' }}>
                {esActivo && <span style={{ width: 5, height: 5, borderRadius: 3, background: '#fff', animation: 'pulse 1.4s ease-in-out infinite', display: 'inline-block' }} />}
                {esActivo ? 'EN VIVO' : 'PROGRAMADO'}
              </span>
              <span style={{ color: 'rgba(255,255,255,0.76)', fontSize: 12, fontWeight: 700 }}>
                {formatDropDate(drop.inicia_at)}
              </span>
            </div>
          </div>

          <div style={{ padding: '24px 24px 22px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 22 }}>
            <div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.48)', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
                {tienda.nombre}
              </div>
              <h1 style={{ fontSize: 34, lineHeight: 1.02, fontWeight: 900, color: '#fff', letterSpacing: 0, margin: '0 0 12px', overflowWrap: 'anywhere' }}>
                {drop.nombre}
              </h1>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.78)', borderRadius: 20, padding: '6px 11px', fontSize: 12, fontWeight: 700 }}>
                  <Icons.box width={13} height={13} />
                  {prendasTotales} unidades
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.78)', borderRadius: 20, padding: '6px 11px', fontSize: 12, fontWeight: 700 }}>
                  <Icons.eye width={13} height={13} />
                  {viewers} viendo
                </span>
                {anotadasCount > 0 && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.78)', borderRadius: 20, padding: '6px 11px', fontSize: 12, fontWeight: 700 }}>
                    <Icons.bell width={13} height={13} />
                    {anotadasCount} anotadas
                  </span>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'end' }}>
              <div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.46)', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'var(--font-mono)', marginBottom: 5 }}>
                  {esActivo ? 'Cierra en' : 'Abre en'}
                </div>
                <div style={{ color: '#fff', fontSize: 28, letterSpacing: 0 }}>
                  <CountdownInline target={dropTarget} urgent={esActivo} />
                </div>
              </div>
              <button
                onClick={() => {
                  if (esActivo) document.getElementById('drop-prendas')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  else if (esProgramado) document.getElementById('drop-aviso')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  else irCatalogo();
                }}
                style={{ height: 44, borderRadius: 8, border: '1px solid rgba(255,255,255,0.22)', background: esActivo ? '#fff' : 'rgba(255,255,255,0.1)', color: esActivo ? '#111' : '#fff', padding: '0 15px', fontSize: 13, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                {esActivo ? 'Ver prendas' : esProgramado ? 'Avisarme' : 'Ver catálogo'}
              </button>
            </div>
          </div>
        </div>
      </section>


      {/* ── MAIN ── */}
      <div id="drop-prendas" style={{ maxWidth: 1100, margin: '0 auto', padding: '18px 14px 80px' }}>

        {/* Stats bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontSize: 13, color: '#666' }}>
            {prendasDisponibles > 0
              ? <><span style={{ color: '#16a34a', fontWeight: 700 }}>{prendasDisponibles}</span> disponibles de {prendasTotales}</>
              : <span style={{ color: '#888' }}>Sin prendas disponibles</span>}
          </div>
        </div>

        {/* ── LAYOUT: grid + actividad side-by-side when active ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: esActivo ? 'minmax(0,1fr) 320px' : '1fr',
          gap: 16,
          alignItems: 'start',
        }}>
          {/* ── GRID PRENDAS ── */}
          <div>
            {prendas.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '42px 16px', color: '#999', fontSize: 14, background: '#fff', border: '1px solid rgba(0,0,0,0.07)', borderRadius: 8 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#222', marginBottom: 4 }}>Todavía no hay prendas publicadas</div>
                <div>Cuando la tienda agregue prendas, aparecerán aquí.</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
                {prendas.map((p, i) => {
                  const tone = TONES[i % TONES.length];
                  const foto = p.fotos?.[0];
                  const disponible = p.estado === 'disponible';
                  const vendida = p.estado === 'vendida';
                  const apartada = p.estado === 'apartada';
                  const card = (
                    <div style={{
                      borderRadius: 14, overflow: 'hidden', background: '#fff',
                      border: '1px solid rgba(0,0,0,0.07)',
                      transition: 'transform .18s',
                      position: 'relative',
                    }}
                      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}
                    >
                      <div style={{ position: 'relative', aspectRatio: '3/4', overflow: 'hidden' }}>
                        {foto ? (
                          <Image
                            src={cld(foto, 'card')}
                            alt={p.nombre}
                            fill
                            sizes="(max-width: 640px) 50vw, 200px"
                            style={{
                              objectFit: 'cover', display: 'block',
                              filter: !disponible ? 'grayscale(0.5) brightness(0.82)' : isPreview ? 'brightness(0.9)' : 'none',
                            }}
                          />
                        ) : (
                          <div style={{
                            width: '100%', height: '100%',
                            background: !disponible ? '#ece9e4' : undefined,
                            backgroundImage: !disponible ? 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0,0,0,0.04) 10px, rgba(0,0,0,0.04) 11px)' : undefined,
                          }}>
                            {disponible && <Ph tone={tone} aspect="3/4" radius={0} />}
                          </div>
                        )}
                        {isPreview && disponible && (
                          <div style={{ position: 'absolute', left: 10, top: 10 }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(10,10,10,0.78)', color: '#fff', borderRadius: 20, padding: '5px 9px', fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                              Preview
                            </span>
                          </div>
                        )}
                        {!disponible && (
                          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{
                              background: vendida ? 'rgba(10,10,10,0.85)' : 'rgba(120,60,0,0.85)',
                              backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
                              color: '#fff', borderRadius: 8, padding: '7px 14px',
                              fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                            }}>
                              {vendida ? 'Vendida' : 'Apartada'}
                            </div>
                          </div>
                        )}
                      </div>
                      <div style={{ padding: '10px 12px 12px' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: disponible ? '#0a0a0a' : '#aaa' }}>
                          {p.nombre}
                        </div>
                        {p.marca && (
                          <div style={{ fontSize: 11, color: '#bbb', marginBottom: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {p.marca}
                          </div>
                        )}
                        {(() => {
                          const sizes = getProductSizes(p);
                          const qtys = sizes.length > 0 ? getProductSizeQuantities(p) : {};
                          if (sizes.length === 0) return <div style={{ marginBottom: 8, height: 4 }} />;
                          return (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                              {sizes.map(size => {
                                const qty = qtys[size] ?? 0;
                                const avail = disponible && qty > 0;
                                return (
                                  <span key={size} style={{
                                    fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 6,
                                    background: avail ? '#f0fdf4' : vendida ? '#f5f5f5' : apartada ? '#fffbeb' : '#f5f5f5',
                                    color: avail ? '#16a34a' : vendida ? '#ccc' : apartada ? '#d97706' : '#ccc',
                                    border: `1px solid ${avail ? '#bbf7d0' : vendida ? '#e5e5e5' : apartada ? '#fde68a' : '#e5e5e5'}`,
                                  }}>
                                    {size}
                                  </span>
                                );
                              })}
                            </div>
                          );
                        })()}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span className="mono tnum" style={{ fontSize: 16, fontWeight: 700, letterSpacing: 0, color: !disponible ? '#ccc' : '#0a0a0a', textDecoration: !disponible ? 'line-through' : 'none' }}>
                            L {p.precio.toLocaleString()}
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600 }}>
                            <span style={{ width: 5, height: 5, borderRadius: 3, flexShrink: 0, display: 'inline-block', background: vendida ? '#ef4444' : apartada ? '#f59e0b' : isPreview ? '#888' : '#22c55e' }} />
                            <span style={{ color: vendida ? '#ef4444' : apartada ? '#f59e0b' : isPreview ? '#777' : '#16a34a' }}>
                              {vendida ? 'Vendida' : apartada ? 'Apartada' : isPreview ? 'Preview' : 'Disponible'}
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>
                  );

                  return esActivo ? (
                    <Link
                      key={p.id}
                      href={`/${tienda.username}/drop/${drop.id}/prenda/${p.id}`}
                      style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
                    >
                      {card}
                    </Link>
                  ) : (
                    <button
                      key={p.id}
                      onClick={() => setPreviewNoticeOpen(true)}
                      style={{ width: '100%', appearance: 'none', border: 'none', padding: 0, margin: 0, background: 'transparent', color: 'inherit', textAlign: 'left', cursor: 'pointer', display: 'block', font: 'inherit' }}
                    >
                      {card}
                    </button>
                  );
                })}
              </div>
            )}

            {esProgramado && <AnotarseSection dropId={drop.id} />}
          </div>

          {/* ── ACTIVIDAD EN VIVO ── */}
          {esActivo && (
            <div style={{ position: 'sticky', top: 68 }}>
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.07)', overflow: 'hidden' }}>
                <div style={{
                  padding: '12px 14px', borderBottom: '1px solid rgba(0,0,0,0.07)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#999', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: 3, background: '#ef4444', display: 'inline-block', animation: 'pulse 1.4s ease-in-out infinite' }} />
                    Actividad en vivo
                  </div>
                  <span style={{ fontSize: 11, color: '#aaa', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Icons.eye width={11} height={11} />
                    {viewers}
                  </span>
                </div>

                {actividadLive.length === 0 ? (
                  <div style={{ padding: '28px 16px', textAlign: 'center' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 18, background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
                      <Icons.eye width={16} height={16} style={{ color: '#bbb' }} />
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#333', marginBottom: 4 }}>Esperando actividad</div>
                    <div style={{ fontSize: 11, color: '#bbb', lineHeight: 1.5 }}>Las compras y apartados aparecerán aquí en tiempo real.</div>
                  </div>
                ) : (
                  <div style={{ padding: '10px 14px 14px', display: 'grid', gap: 14, maxHeight: 520, overflowY: 'auto' }}>
                    {actividadLive.map(a => {
                      const partes = a.texto.split('·').map(s => s.trim());
                      const nombre = partes[0] ?? '';
                      const prenda = partes[1] ?? '';
                      const talla = partes[2] ?? '';
                      const esCompra = a.tipo === 'compra';
                      const esApartado = a.tipo === 'apartado';
                      const letraAvatar = nombre.charAt(0).toUpperCase();

                      return (
                        <div key={a.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                          <div style={{
                            width: 36, height: 36, borderRadius: 18, flexShrink: 0,
                            background: esCompra ? '#0a0a0a' : esApartado ? '#fef3c7' : '#f0efed',
                            color: esCompra ? '#fff' : esApartado ? '#92400e' : '#888',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 13, fontWeight: 700,
                          }}>
                            {letraAvatar}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, lineHeight: 1.4 }}>
                              <span style={{ fontWeight: 700 }}>{nombre}</span>
                              {esApartado && <span style={{ color: '#d97706', fontWeight: 500 }}> apartó</span>}
                              {esCompra && <span style={{ color: '#555', fontWeight: 500 }}> compró</span>}
                            </div>
                            {prenda && (
                              <div style={{ fontSize: 13, fontWeight: 600, color: '#222', marginTop: 2 }}>
                                {prenda}{talla && <span style={{ color: '#999', fontWeight: 500 }}> · {talla}</span>}
                              </div>
                            )}
                            <div className="mono" style={{ fontSize: 10, color: '#bbb', marginTop: 3 }}>{formatRelativo(a.created_at)}</div>
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
      style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(0,0,0,0.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18, backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: 'min(430px, 100%)', background: '#fff', borderRadius: 12, border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 24px 80px rgba(0,0,0,0.22)', padding: 22 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#999', marginBottom: 7 }}>Preview del drop</div>
            <div style={{ fontSize: 22, lineHeight: 1.08, fontWeight: 900, color: '#111', letterSpacing: 0 }}>
              {dropName} todavía no abre
            </div>
          </div>
          <button onClick={onClose} aria-label="Cerrar" style={{ width: 32, height: 32, borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <Icons.close width={16} height={16} />
          </button>
        </div>
        <p style={{ margin: '0 0 18px', fontSize: 14, color: '#666', lineHeight: 1.55 }}>
          Estas prendas se pueden ver, pero la compra se activa hasta que el drop esté en vivo.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button onClick={onCatalogo} className="btn btn-outline" style={{ height: 44, borderRadius: 8 }}>
            Ver catálogo
          </button>
          <button onClick={onAviso} className="btn btn-primary" style={{ height: 44, borderRadius: 8 }}>
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
    });
    if (err) { setError('No pudimos registrarte. Intentá de nuevo.'); setLoading(false); return; }
    setDone(true);
    setLoading(false);
  }

  if (done) {
    return (
      <div id="drop-aviso" style={{ marginTop: 20, marginBottom: 16, background: '#fff', borderRadius: 8, border: '1px solid rgba(0,0,0,0.07)', padding: '28px 20px', textAlign: 'center' }}>
        <div style={{ width: 52, height: 52, borderRadius: 26, background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, margin: '0 auto 14px' }}>✓</div>
        <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: 0, marginBottom: 6 }}>¡Listo, te anotaste!</div>
        <div style={{ fontSize: 13, color: '#888', lineHeight: 1.6 }}>
          Te avisamos por WhatsApp 15 min antes de que abra el drop.
        </div>
      </div>
    );
  }

  return (
    <div id="drop-aviso" style={{ marginTop: 20, marginBottom: 16, background: '#fff', borderRadius: 8, border: '1px solid rgba(0,0,0,0.07)', padding: '22px 20px' }}>
      <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: 0, marginBottom: 4 }}>
        ¿Querés que te avisemos?
      </div>
      <div style={{ fontSize: 13, color: '#888', marginBottom: 20, lineHeight: 1.55 }}>
        Te mandamos un WhatsApp 15 min antes de que abra el drop.
      </div>
      <div style={{ marginBottom: 10 }}>
        <label className="label">WhatsApp</label>
        <PhoneInput value={telefono} onChange={v => { setTelefono(v); setError(''); }} />
      </div>
      <div style={{ marginBottom: 18 }}>
        <label className="label">
          Email <span style={{ fontWeight: 400, color: '#bbb' }}>(opcional)</span>
        </label>
        <input
          className="input"
          type="email"
          placeholder="karla@gmail.com"
          value={email}
          onChange={e => { setEmail(e.target.value); setError(''); }}
        />
      </div>
      {error && <div style={{ fontSize: 13, color: '#dc2626', marginBottom: 12, padding: '10px 14px', background: '#fef2f2', borderRadius: 8 }}>{error}</div>}
      <button className="btn btn-primary btn-block" style={{ height: 48 }} onClick={handleAnotarse} disabled={loading}>
        {loading ? 'Registrando...' : 'Anotarme'}
      </button>
    </div>
  );
}
