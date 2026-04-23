'use client';

import Image from 'next/image';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Icons } from '@/components/shared/icons';
import { Ph } from '@/components/shared/image-placeholder';
import { BuyerCheckoutAccess } from '@/components/buyer/buyer-checkout-access';
import type { BuyerProfile } from '@/components/buyer/buyer-auth-modal';
import type { Database } from '@/types/database';
import { obtenerPerfilComprador } from '@/lib/buyer/actions';
import { crearCheckoutPublico } from '@/lib/checkout/actions';
import { uploadImage } from '@/lib/cloudinary/client';
import {
  formatProductSizes,
  getAvailableProductSizes,
  getPrimaryProductSize,
  getProductSizeQuantities,
  getProductSizeQuantity,
  getProductSizes,
  getProductTotalQuantity,
} from '@/lib/product-sizes';
import { createClient } from '@/lib/supabase/client';
import { useCarrito } from '@/hooks/use-carrito';

type Tienda = Database['public']['Tables']['tiendas']['Row'];
type Prenda = Database['public']['Tables']['prendas']['Row'];
type MetodoPago = Database['public']['Tables']['metodos_pago']['Row'];
type MetodoEnvio = Database['public']['Tables']['metodos_envio']['Row'];
type PrendaMin = Pick<Prenda, 'id' | 'nombre' | 'marca' | 'talla' | 'tallas' | 'cantidad' | 'cantidades_por_talla' | 'precio' | 'fotos' | 'estado'>;

type Tone = 'rose' | 'sand' | 'sage' | 'blue' | 'dark' | 'neutral';
const TONES: Tone[] = ['rose', 'sand', 'sage', 'blue', 'dark', 'neutral'];

type CheckoutStep = 'none' | 'envio' | 'pago' | 'confirmado';

export function PrendaCatalogoClient({
  tienda,
  prenda,
  metodosPago,
  metodosEnvio,
  otrasPrendas,
  tiendaEmail,
}: {
  tienda: Tienda;
  prenda: Prenda;
  metodosPago: MetodoPago[];
  metodosEnvio: MetodoEnvio[];
  otrasPrendas: PrendaMin[];
  tiendaEmail: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fotoIdx, setFotoIdx] = useState(0);
  const [checkoutStep, setCheckoutStep] = useState<CheckoutStep>('none');
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [direccion, setDireccion] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [buyer, setBuyer] = useState<BuyerProfile | null>(null);
  const [metodoEnvioId, setMetodoEnvioId] = useState(metodosEnvio[0]?.id ?? '');
  const [metodoPagoId, setMetodoPagoId] = useState(metodosPago[0]?.id ?? '');
  const [uploading, setUploading] = useState(false);
  const [comprobanteUrl, setComprobanteUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [loadingPedido, setLoadingPedido] = useState(false);
  const [pedidoNumero, setPedidoNumero] = useState('');
  const [pedidoTrackingUrl, setPedidoTrackingUrl] = useState('');
  const [prendaEstado, setPrendaEstado] = useState(prenda.estado);
  const [prendaCantidad, setPrendaCantidad] = useState(getProductTotalQuantity(prenda));
  const [cantidadesPorTalla, setCantidadesPorTalla] = useState<Record<string, number>>(getProductSizeQuantities(prenda));
  const [tallaSeleccionada, setTallaSeleccionada] = useState(getAvailableProductSizes(prenda)[0] ?? getPrimaryProductSize(prenda) ?? '');

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`prenda-catalogo-${prenda.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'prendas',
        filter: `id=eq.${prenda.id}`,
      }, payload => {
        const nuevo = payload.new as { estado: Prenda['estado']; cantidad?: number | null; cantidades_por_talla?: Record<string, number> | null };
        if (nuevo.estado) setPrendaEstado(nuevo.estado);
        if (typeof nuevo.cantidad === 'number') setPrendaCantidad(nuevo.cantidad);
        if (nuevo.cantidades_por_talla && typeof nuevo.cantidades_por_talla === 'object') {
          setCantidadesPorTalla(nuevo.cantidades_por_talla);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [prenda.id]);

  useEffect(() => {
    (async () => {
      const res = await obtenerPerfilComprador();
      if (!res.comprador) return;
      aplicarBuyer(res.comprador);
    })();
  }, []);

  function aplicarBuyer(profile: BuyerProfile) {
    setBuyer(profile);
    setNombre(profile.nombre);
    setEmail(profile.email);
    setWhatsapp(profile.telefono ?? '');
    setDireccion(profile.direccion ?? '');
    setCiudad(profile.ciudad ?? '');
    setErrorMsg('');
  }

  const fotos = prenda.fotos ?? [];
  const metodoEnvioSel = metodosEnvio.find(m => m.id === metodoEnvioId);
  const metodoPagoSel = metodosPago.find(m => m.id === metodoPagoId);
  const costoEnvio = metodoEnvioSel?.precio ?? 0;
  const total = prenda.precio + costoEnvio;
  const prendaRuntime = useMemo(() => ({
    ...prenda,
    estado: prendaEstado,
    cantidad: prendaCantidad,
    cantidades_por_talla: cantidadesPorTalla,
  }), [prenda, prendaEstado, prendaCantidad, cantidadesPorTalla]);
  const tallasProducto = getProductSizes(prendaRuntime);
  const tallasDisponibles = getAvailableProductSizes(prendaRuntime);
  const tallaActiva = useMemo(() => {
    if (tallasProducto.length === 0) return '';
    // Si el usuario seleccionó una talla, úsala siempre (con o sin stock)
    if (tallaSeleccionada) return tallaSeleccionada;
    return tallasDisponibles[0] ?? getPrimaryProductSize(prendaRuntime) ?? '';
  }, [prendaRuntime, tallaSeleccionada, tallasDisponibles, tallasProducto.length]);
  const cantidadTallaSeleccionada = tallasProducto.length > 0
    ? getProductSizeQuantity(prendaRuntime, tallaActiva)
    : prendaCantidad;
  const tieneStock = prendaEstado === 'disponible' && (tallasProducto.length > 0 ? cantidadTallaSeleccionada > 0 : prendaCantidad > 0);
  const initials = tienda.nombre.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  function abrirCheckout() {
    if (tallasProducto.length > 0 && !tallaActiva) {
      setErrorMsg('Seleccioná una talla disponible.');
      return;
    }
    setCheckoutStep('envio');
    setErrorMsg('');
  }

  async function subirComprobante(file: File) {
    setUploading(true);
    try {
      const result = await uploadImage(file, { folder: 'fardodrops/comprobantes' });
      setComprobanteUrl(result.url);
    } catch {
      setErrorMsg('No se pudo subir el comprobante.');
    } finally {
      setUploading(false);
    }
  }

  async function confirmarApartado() {
    if (!tieneStock) { setErrorMsg('Esta prenda ya no tiene unidades disponibles.'); return; }
    if (tallasProducto.length > 0 && !tallaActiva) { setErrorMsg('Seleccioná una talla disponible.'); return; }
    if (!nombre.trim()) { setErrorMsg('Ingresá tu nombre completo.'); return; }
    if (!whatsapp.trim()) { setErrorMsg('Ingresá tu número de WhatsApp.'); return; }
    if (!direccion.trim()) { setErrorMsg('Ingresá tu dirección.'); return; }
    if (!ciudad.trim()) { setErrorMsg('Ingresá tu ciudad.'); return; }
    if (!metodoEnvioId) { setErrorMsg('Seleccioná un método de envío.'); return; }
    if (!metodoPagoId) { setErrorMsg('Seleccioná un método de pago.'); return; }
    if (metodoPagoSel?.tipo === 'transferencia' && !comprobanteUrl) {
      setErrorMsg('Debés subir el comprobante de transferencia para completar la compra.');
      return;
    }
    setLoadingPedido(true);
    setErrorMsg('');
    const res = await crearCheckoutPublico({
      tiendaId: tienda.id,
      dropId: null,
      items: [{ prendaId: prenda.id, talla: tallaActiva || null }],
      nombre: nombre.trim(),
      email: email.trim() || null,
      whatsapp: whatsapp.trim(),
      direccion: direccion.trim(),
      ciudad: ciudad.trim(),
      metodoEnvioId,
      metodoPagoId,
      comprobanteUrl,
    });

    if (res.error || !res.pedido) {
      setErrorMsg(res.error ?? 'Error al crear el pedido. Intentá de nuevo.');
      setLoadingPedido(false);
      return;
    }

    const siguienteCantidad = Math.max(prendaCantidad - 1, 0);
    if (tallasProducto.length > 0 && tallaActiva) {
      const siguienteTalla = Math.max((cantidadesPorTalla[tallaActiva] ?? 0) - 1, 0);
      const nextMap = { ...cantidadesPorTalla, [tallaActiva]: siguienteTalla };
      setCantidadesPorTalla(nextMap);
      if (siguienteTalla === 0) {
        setTallaSeleccionada(tallasProducto.find(size => size !== tallaActiva && (nextMap[size] ?? 0) > 0) ?? '');
      }
    }
    setPrendaCantidad(siguienteCantidad);
    setPrendaEstado(siguienteCantidad > 0 ? 'disponible' : 'vendida');

    setPedidoNumero(res.pedido.numero);
    setPedidoTrackingUrl(res.pedido.trackingUrl);
    setCheckoutStep('confirmado');
    setLoadingPedido(false);
  }

  const checkoutOpen = checkoutStep !== 'none';
  const { agregarItem, tieneItem, abrirDrawer } = useCarrito();
  const enCarrito = tieneItem(prenda.id, tallasProducto.length > 0 ? (tallaActiva || null) : null);

  return (
    <div className="buyer-product-page" style={{ minHeight: '100vh', background: '#fff' }}>

      {/* NAV */}
      <nav className="buyer-product-nav" style={{
        position: 'sticky', top: 0, zIndex: 40, background: '#fff',
        borderBottom: '1px solid var(--line)',
        padding: '0 40px', height: 56,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div className="buyer-product-nav-left" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => router.back()}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 13, padding: 0 }}
          >
            <Icons.back width={16} height={16} />
            Volver
          </button>
          <span style={{ color: 'var(--line)', margin: '0 8px' }}>·</span>
          <span className="buyer-product-breadcrumb" style={{ fontSize: 13, color: 'var(--ink-3)' }}>
            <Link href={`/${tienda.username}`} style={{ color: 'inherit', textDecoration: 'none' }}>{tienda.nombre}</Link>
            {' / '}
            <Link href={`/${tienda.username}#catalogo`} style={{ color: 'inherit', textDecoration: 'none' }}>Catálogo</Link>
            {' / '}
            <span style={{ color: 'var(--ink)' }}>{prenda.nombre}</span>
          </span>
        </div>
        {tienda.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <Image src={tienda.logo_url} alt={tienda.nombre} width={28} height={28} style={{ borderRadius: 14, objectFit: 'cover' }} />
        ) : (
          <div style={{ width: 28, height: 28, borderRadius: 14, background: '#e4d4d0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{initials}</div>
        )}
      </nav>

      {/* MAIN */}
      <div className="buyer-product-main" style={{ maxWidth: 1200, margin: '0 auto', padding: '48px 40px', display: 'grid', gridTemplateColumns: '1fr 480px', gap: 64 }}>

        {/* GALERÍA */}
        <div className="buyer-product-gallery" style={{ display: 'grid', gridTemplateColumns: '72px 1fr', gap: 12 }}>
          <div className="buyer-product-thumbs" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {fotos.length > 0 ? fotos.map((f, i) => (
              <button
                key={i}
                onClick={() => setFotoIdx(i)}
                style={{
                  width: 72, height: 90, borderRadius: 8, overflow: 'hidden', border: 'none', padding: 0, cursor: 'pointer',
                  outline: i === fotoIdx ? '2px solid var(--ink)' : '2px solid transparent',
                  outlineOffset: 2, transition: 'outline .12s', position: 'relative',
                }}
              >
                <Image src={f} alt="" fill sizes="72px" style={{ objectFit: 'cover' }} />
              </button>
            )) : [0, 1, 2].map(i => (
              <div key={i} style={{ width: 72, height: 90, borderRadius: 8, overflow: 'hidden', outline: i === fotoIdx ? '2px solid var(--ink)' : '2px solid transparent', outlineOffset: 2 }}>
                <Ph tone={TONES[i % TONES.length]} aspect="4/5" radius={0} />
              </div>
            ))}
          </div>

          <div className="buyer-product-media" style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', background: '#f5f5f5' }}>
            {fotos.length > 0 ? (
              <Image
                src={fotos[fotoIdx]}
                alt={prenda.nombre}
                fill
                sizes="(max-width: 1024px) 100vw, 600px"
                style={{ objectFit: 'cover', display: 'block' }}
              />
            ) : (
              <Ph tone={TONES[0]} aspect="4/5" radius={0} />
            )}
            {fotos.length > 1 && (
              <>
                <button
                  onClick={() => setFotoIdx(i => Math.max(0, i - 1))}
                  disabled={fotoIdx === 0}
                  style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', width: 40, height: 40, borderRadius: 20, background: 'rgba(255,255,255,0.9)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: fotoIdx === 0 ? 0.3 : 1, transition: 'opacity .12s' }}
                >
                  <Icons.back width={18} height={18} />
                </button>
                <button
                  onClick={() => setFotoIdx(i => Math.min(fotos.length - 1, i + 1))}
                  disabled={fotoIdx === fotos.length - 1}
                  style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', width: 40, height: 40, borderRadius: 20, background: 'rgba(255,255,255,0.9)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: fotoIdx === fotos.length - 1 ? 0.3 : 1, transition: 'opacity .12s' }}
                >
                  <Icons.arrow width={18} height={18} />
                </button>
              </>
            )}
            {prendaEstado !== 'disponible' && (
              <>
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.22)' }} />
                <div style={{ position: 'absolute', top: 16, right: 16, background: prendaEstado === 'vendida' ? 'rgba(10,10,10,0.88)' : 'rgba(180,100,0,0.88)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', color: '#fff', borderRadius: 20, padding: '6px 14px', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  {prendaEstado === 'vendida' ? 'Vendida' : prendaEstado === 'apartada' ? 'Apartada' : prendaEstado}
                </div>
              </>
            )}
            {fotos.length > 1 && (
              <div style={{ position: 'absolute', bottom: 16, right: 16 }}>
                <span className="mono" style={{ fontSize: 11, background: 'rgba(0,0,0,0.5)', color: '#fff', padding: '4px 10px', borderRadius: 20 }}>
                  {fotoIdx + 1} / {fotos.length}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* INFO */}
        <div className="buyer-product-info" style={{ paddingTop: 8 }}>
          {prenda.marca && (
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
              {prenda.marca}
            </div>
          )}
          <h1 className="buyer-product-title" style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 4px', lineHeight: 1.15 }}>
            {prenda.nombre}
          </h1>
          {prenda.categoria && (
            <div style={{ fontSize: 15, color: 'var(--ink-2)', marginBottom: 16 }}>{prenda.categoria}</div>
          )}
          <div className="buyer-product-price-row" style={{ display: 'flex', alignItems: 'baseline', gap: 10, margin: '20px 0' }}>
            <span className="mono tnum" style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.03em' }}>
              L {prenda.precio.toLocaleString()}
            </span>
            {tieneStock && (
              <span style={{ fontSize: 13, color: 'var(--ok)', fontWeight: 500 }}>
                {cantidadTallaSeleccionada === 1 ? 'Solo queda 1' : `${cantidadTallaSeleccionada} disponibles`}
              </span>
            )}
          </div>
          <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '20px 0' }} />
          <div className="buyer-product-meta-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            {tallasProducto.length > 0 && (
              <div>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-3)', marginBottom: 6 }}>Talla</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {tallasProducto.map(size => {
                    const disponibleEnTalla = getProductSizeQuantity(prendaRuntime, size);
                    const agotada = disponibleEnTalla <= 0;
                    return (
                    <button
                      key={size}
                      type="button"
                      onClick={() => {
                        if (agotada) return;
                        setTallaSeleccionada(size);
                        setErrorMsg('');
                      }}
                      disabled={agotada}
                      style={{
                        minWidth: 48,
                        height: 48,
                        padding: '0 14px',
                        border: `2px solid ${tallaActiva === size ? 'var(--ink)' : agotada ? 'var(--line-2)' : 'var(--line)'}`,
                        borderRadius: 8,
                        background: tallaActiva === size ? '#fff' : agotada ? '#f6f4f1' : 'var(--surface-2)',
                        color: agotada ? 'var(--ink-3)' : 'var(--ink)',
                        fontSize: 16,
                        fontWeight: 600,
                        cursor: agotada ? 'not-allowed' : 'pointer',
                        opacity: agotada ? 0.55 : 1,
                      }}
                    >
                      {size}
                    </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-3)', marginBottom: 6 }}>Disponibles</div>
              <div className="mono tnum" style={{ fontSize: 18, fontWeight: 700 }}>
                {tieneStock
                  ? (tallasProducto.length > 0
                    ? getProductSizeQuantity(prendaRuntime, tallaActiva)
                    : prendaCantidad)
                  : 0}
              </div>
            </div>
          </div>
          {prenda.descripcion && (
            <p style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--ink-2)', margin: '0 0 24px' }}>
              {prenda.descripcion}
            </p>
          )}

          {tieneStock ? (
            <div className="buyer-product-actions" style={{ display: 'grid', gap: 10 }}>
              <button
                className="btn btn-primary"
                style={{ height: 56, fontSize: 16, fontWeight: 600, borderRadius: 12 }}
                onClick={abrirCheckout}
              >
                Comprar ahora
              </button>
              <button
                style={{
                  height: 52, fontSize: 15, fontWeight: 600, borderRadius: 12,
                  border: '1.5px solid var(--ink)',
                  background: enCarrito ? '#f5f5f5' : '#fff',
                  color: 'var(--ink)',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transition: 'background .15s',
                }}
                onClick={() => {
                  if (enCarrito) {
                    abrirDrawer();
                  } else {
                    agregarItem({
                      prendaId: prenda.id,
                      nombre: prenda.nombre,
                      marca: prenda.marca,
                      talla: tallaActiva || null,
                      precio: prenda.precio,
                      foto: prenda.fotos?.[0] ?? null,
                      tiendaUsername: tienda.username,
                      tiendaId: tienda.id,
                    });
                  }
                }}
              >
                <Icons.bag width={18} height={18} />
                {enCarrito ? 'Ver carrito' : 'Añadir al carrito'}
              </button>
              <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '14px 16px', background: '#fff', marginTop: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                  Devoluciones y Cancelaciones
                </div>
                <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6 }}>
                  Una vez procesada la compra NO se puede cancelar la orden. NO hay devoluciones de ningún tipo.
                  {tiendaEmail && (
                    <> Por favor contactar por correo electrónico a{' '}
                      <a href={`mailto:${tiendaEmail}`} style={{ color: 'var(--ink)', fontWeight: 600, textDecoration: 'underline' }}>{tiendaEmail}</a>.
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ borderRadius: 14, overflow: 'hidden', border: '1.5px solid var(--line)' }}>
              <div style={{ background: prendaEstado === 'vendida' ? '#0a0a0a' : '#92400e', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: 4, background: '#fff', opacity: 0.5, flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  {prendaEstado === 'vendida' ? 'Vendida' : 'Apartada'}
                </span>
              </div>
              <div style={{ padding: '16px 20px', background: '#fff' }}>
                <div style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.55 }}>
                  {prendaEstado === 'vendida'
                    ? 'Esta prenda ya encontró dueño. Mirá otras prendas del catálogo.'
                    : 'Esta prenda está apartada temporalmente. Si no se completa el pago, volverá al catálogo.'}
                </div>
                <button className="btn btn-outline" style={{ height: 44, marginTop: 12 }} onClick={() => router.push(`/${tienda.username}#catalogo`)}>
                  Ver catálogo
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* OTRAS PRENDAS */}
      {otrasPrendas.length > 0 && (
        <div className="buyer-related-section" style={{ maxWidth: 1200, margin: '0 auto', padding: '0 40px 64px' }}>
          <hr style={{ border: 'none', borderTop: '1px solid var(--line)', marginBottom: 40 }} />
          <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.015em', marginBottom: 20 }}>
            Más prendas del catálogo
          </div>
          <div className="buyer-related-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            {otrasPrendas.map((p, i) => (
              <Link
                key={p.id}
                href={`/${tienda.username}/prenda/${p.id}`}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div style={{ cursor: 'pointer' }}>
                  <div style={{ borderRadius: 12, overflow: 'hidden', marginBottom: 10, position: 'relative', aspectRatio: '3/4' }}>
                    {p.fotos?.[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <Image src={p.fotos[0]} alt={p.nombre} fill sizes="(max-width: 1024px) 25vw, 200px" style={{ objectFit: 'cover', display: 'block' }} />
                    ) : (
                      <Ph tone={TONES[i % TONES.length]} aspect="3/4" radius={0} />
                    )}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{p.nombre}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
                    {[p.marca, formatProductSizes(p), `${getProductTotalQuantity(p)} disp.`].filter(Boolean).join(' · ')}
                  </div>
                  <div className="mono tnum" style={{ fontSize: 14, fontWeight: 600, marginTop: 6 }}>L {p.precio}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* CHECKOUT */}
      {checkoutOpen && tieneStock && (
        <div
          className="buyer-checkout-overlay"
          style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex' }}
          onClick={e => { if (e.target === e.currentTarget) setCheckoutStep('none'); }}
        >
          <div className="buyer-checkout-backdrop" style={{ flex: 1, background: 'rgba(0,0,0,0.3)' }} onClick={() => setCheckoutStep('none')} />
          <div className="buyer-checkout-drawer" style={{ width: 480, background: '#fff', height: '100vh', overflowY: 'auto', boxShadow: '-20px 0 60px rgba(0,0,0,0.12)', animation: 'slideIn .22s ease' }}>
            {checkoutStep === 'envio' && (
              <EnvioPanel
                prenda={prenda}
                tallaSeleccionada={tallaActiva || null}
                nombre={nombre} email={email} whatsapp={whatsapp} direccion={direccion} ciudad={ciudad}
                buyer={buyer}
                metodoEnvioId={metodoEnvioId} metodosEnvio={metodosEnvio}
                costoEnvio={costoEnvio} total={total} errorMsg={errorMsg}
                onChange={(f, v) => {
                  if (f === 'nombre') setNombre(v);
                  if (f === 'email') setEmail(v);
                  if (f === 'whatsapp') setWhatsapp(v);
                  if (f === 'direccion') setDireccion(v);
                  if (f === 'ciudad') setCiudad(v);
                  if (f === 'metodoEnvioId') setMetodoEnvioId(v);
                  setErrorMsg('');
                }}
                onBuyer={aplicarBuyer}
                onContinuar={() => {
                  if (!nombre.trim()) { setErrorMsg('Ingresá tu nombre completo.'); return; }
                  if (!whatsapp.trim()) { setErrorMsg('Ingresá tu número de WhatsApp.'); return; }
                  if (!direccion.trim()) { setErrorMsg('Ingresá tu dirección.'); return; }
                  if (!ciudad.trim()) { setErrorMsg('Ingresá tu ciudad.'); return; }
                  if (!metodoEnvioId) { setErrorMsg('Seleccioná un método de envío.'); return; }
                  setCheckoutStep('pago');
                  setErrorMsg('');
                }}
                onCerrar={() => setCheckoutStep('none')}
              />
            )}
            {checkoutStep === 'pago' && (
              <PagoPanel
                prenda={prenda}
                tallaSeleccionada={tallaActiva || null}
                metodosPago={metodosPago} metodoPagoId={metodoPagoId}
                tiendaEmail={tiendaEmail} costoEnvio={costoEnvio} total={total}
                uploading={uploading} comprobanteUrl={comprobanteUrl}
                errorMsg={errorMsg} loading={loadingPedido} fileRef={fileRef}
                onChange={(f, v) => { if (f === 'metodoPagoId') setMetodoPagoId(v); setErrorMsg(''); }}
                onSubirComprobante={subirComprobante}
                onConfirmar={confirmarApartado}
                onVolver={() => setCheckoutStep('envio')}
              />
            )}
            {checkoutStep === 'confirmado' && (
              <ConfirmadoPanel
                numero={pedidoNumero}
                tiendaUsername={tienda.username}
                onVerPedido={() => router.push(pedidoTrackingUrl || `/pedido/${pedidoNumero}`)}
                onCerrar={() => setCheckoutStep('none')}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function EnvioPanel({ prenda, tallaSeleccionada, nombre, email, whatsapp, direccion, ciudad, buyer, metodoEnvioId, metodosEnvio, costoEnvio, total, errorMsg, onChange, onBuyer, onContinuar, onCerrar }: {
  prenda: Prenda; tallaSeleccionada: string | null; nombre: string; email: string; whatsapp: string; direccion: string; ciudad: string; buyer: BuyerProfile | null;
  metodoEnvioId: string; metodosEnvio: MetodoEnvio[]; costoEnvio: number; total: number; errorMsg: string;
  onChange: (f: string, v: string) => void; onBuyer: (buyer: BuyerProfile) => void; onContinuar: () => void; onCerrar: () => void;
}) {
  return (
    <div className="buyer-checkout-panel" style={{ padding: '24px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>PASO 1 DE 2</div>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>Envío</div>
        </div>
        <button onClick={onCerrar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', display: 'flex' }}>
          <Icons.close width={20} height={20} />
        </button>
      </div>
      <div style={{ height: 2, background: 'var(--line)', borderRadius: 2, marginBottom: 28 }}>
        <div style={{ height: '100%', width: '50%', background: 'var(--ink)', borderRadius: 2 }} />
      </div>
      <div className="buyer-checkout-summary" style={{ background: 'var(--surface-2)', borderRadius: 12, padding: '14px 16px', marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ width: 56, height: 70, borderRadius: 8, overflow: 'hidden', flexShrink: 0, position: 'relative' }}>
          {prenda.fotos?.[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <Image src={prenda.fotos[0]} alt="" fill sizes="56px" style={{ objectFit: 'cover' }} />
          ) : <Ph tone="rose" aspect="4/5" radius={0} />}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{prenda.nombre}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{prenda.marca}{tallaSeleccionada ? ` · Talla ${tallaSeleccionada}` : ''}</div>
          </div>
          <div className="mono tnum" style={{ fontSize: 15, fontWeight: 700 }}>L {prenda.precio}</div>
        </div>
        <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '12px 0' }} />
        <ResumenLineas precio={prenda.precio} costoEnvio={costoEnvio} total={total} />
      </div>
      <BuyerCheckoutAccess buyer={buyer} onBuyer={onBuyer} />
      <div style={{ marginBottom: 14 }}>
        <label className="label">Nombre completo</label>
        <input className="input input-lg" placeholder="Karla Morales" value={nombre} onChange={e => onChange('nombre', e.target.value)} />
      </div>
      <div style={{ marginBottom: 14 }}>
        <label className="label">WhatsApp</label>
        <input className="input input-lg" placeholder="+504 9876-5432" value={whatsapp} onChange={e => onChange('whatsapp', e.target.value)} />
      </div>
      <div style={{ marginBottom: 6 }}>
        <label className="label">Email <span style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 400 }}>(opcional)</span></label>
        <input className="input input-lg" type="email" placeholder="karla@email.com" value={email} onChange={e => onChange('email', e.target.value)} />
      </div>
      <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 20 }}>Te avisamos por WhatsApp y email cuando salga tu pedido</div>
      <div style={{ marginBottom: 14 }}>
        <label className="label">Dirección</label>
        <input className="input input-lg" placeholder="Col. Kennedy, Calle 5, Casa 12" value={direccion} onChange={e => onChange('direccion', e.target.value)} />
      </div>
      <div className="buyer-checkout-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
        <div>
          <label className="label">Ciudad</label>
          <input className="input input-lg" placeholder="Tegucigalpa" value={ciudad} onChange={e => onChange('ciudad', e.target.value)} />
        </div>
        <div>
          <label className="label">País</label>
          <input className="input input-lg" value="Honduras" readOnly style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }} />
        </div>
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Método de envío</div>
      {metodosEnvio.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--ink-3)', padding: '20px 0', textAlign: 'center' }}>Sin métodos configurados</div>
      ) : (
        <div style={{ display: 'grid', gap: 10, marginBottom: 24 }}>
          {metodosEnvio.map(m => (
            <label key={m.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 16px', border: `1.5px solid ${metodoEnvioId === m.id ? 'var(--ink)' : 'var(--line)'}`, borderRadius: 12, cursor: 'pointer', background: '#fff', transition: 'border-color .12s' }}>
              <input type="radio" name="envio" checked={metodoEnvioId === m.id} onChange={() => onChange('metodoEnvioId', m.id)} style={{ marginTop: 3, accentColor: 'var(--ink)', width: 16, height: 16, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{m.nombre}</div>
                  <div className="mono tnum" style={{ fontSize: 14, fontWeight: 600 }}>{m.precio === 0 ? 'Gratis' : `L ${m.precio}`}</div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{m.proveedor} · {m.tiempo_estimado}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{m.cobertura}</div>
              </div>
            </label>
          ))}
        </div>
      )}
      {errorMsg && <div style={{ fontSize: 13, color: 'var(--urgent)', marginBottom: 12, padding: '10px 14px', background: '#fef2f2', borderRadius: 8 }}>{errorMsg}</div>}
      <button className="btn btn-primary btn-block" style={{ height: 52, fontSize: 15 }} onClick={onContinuar}>
        Continuar al pago
        <Icons.arrow width={15} height={15} />
      </button>
    </div>
  );
}

function PagoPanel({ prenda, tallaSeleccionada, metodosPago, metodoPagoId, tiendaEmail, costoEnvio, total, uploading, comprobanteUrl, errorMsg, loading, fileRef, onChange, onSubirComprobante, onConfirmar, onVolver }: {
  prenda: Prenda; tallaSeleccionada: string | null; metodosPago: MetodoPago[]; metodoPagoId: string; tiendaEmail: string;
  costoEnvio: number; total: number; uploading: boolean; comprobanteUrl: string | null;
  errorMsg: string; loading: boolean; fileRef: React.RefObject<HTMLInputElement | null>;
  onChange: (f: string, v: string) => void;
  onSubirComprobante: (file: File) => void; onConfirmar: () => void; onVolver: () => void;
}) {
  const metodoPago = metodosPago.find(m => m.id === metodoPagoId);
  const esTransferencia = metodoPago?.tipo === 'transferencia';
  const refPedido = `HN-${prenda.id.slice(0, 4).toUpperCase()}`;

  return (
    <div className="buyer-checkout-panel" style={{ padding: '24px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={onVolver} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: 'var(--ink-3)' }}>
            <Icons.back width={20} height={20} />
          </button>
          <div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>PASO 2 DE 2</div>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>Pago</div>
          </div>
        </div>
      </div>
      <div style={{ height: 2, background: 'var(--line)', borderRadius: 2, marginBottom: 28 }}>
        <div style={{ height: '100%', width: '100%', background: 'var(--ink)', borderRadius: 2 }} />
      </div>
      <div className="buyer-checkout-summary" style={{ background: 'var(--surface-2)', borderRadius: 12, padding: '14px 16px', marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ width: 56, height: 70, borderRadius: 8, overflow: 'hidden', flexShrink: 0, position: 'relative' }}>
            {prenda.fotos?.[0] ? (
              <Image src={prenda.fotos[0]} alt="" fill sizes="56px" style={{ objectFit: 'cover' }} />
            ) : <Ph tone="rose" aspect="4/5" radius={0} />}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{prenda.nombre}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{prenda.marca}{tallaSeleccionada ? ` · Talla ${tallaSeleccionada}` : ''}</div>
          </div>
          <div className="mono tnum" style={{ fontSize: 15, fontWeight: 700 }}>L {prenda.precio}</div>
        </div>
        <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '12px 0' }} />
        <ResumenLineas precio={prenda.precio} costoEnvio={costoEnvio} total={total} />
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Método de pago</div>
      <div style={{ display: 'grid', gap: 10, marginBottom: 20 }}>
        {metodosPago.map(m => (
          <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', border: `1.5px solid ${metodoPagoId === m.id ? 'var(--ink)' : 'var(--line)'}`, borderRadius: 12, cursor: 'pointer', background: '#fff', transition: 'border-color .12s' }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icons.bank width={18} height={18} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{m.proveedor}</div>
              {m.detalle && <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{m.detalle}</div>}
            </div>
            <input type="radio" name="pago" checked={metodoPagoId === m.id} onChange={() => onChange('metodoPagoId', m.id)} style={{ accentColor: 'var(--ink)', width: 16, height: 16 }} />
          </label>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', border: '1.5px solid var(--line)', borderRadius: 12, background: 'var(--surface-2)', opacity: 0.6, cursor: 'not-allowed' }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: '#e8e8e8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icons.card width={18} height={18} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
              Pagar con tarjeta
              <span style={{ fontSize: 10, fontWeight: 600, background: 'var(--ink-3)', color: '#fff', padding: '2px 7px', borderRadius: 20, letterSpacing: '0.04em' }}>Próximamente</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Visa · Mastercard</div>
          </div>
          <input type="radio" name="pago" disabled style={{ accentColor: 'var(--ink)', width: 16, height: 16 }} />
        </div>
      </div>
      {esTransferencia && (
        <div style={{ background: 'var(--surface-2)', borderRadius: 12, padding: '16px 18px', marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 8 }}>Transferí este monto exacto:</div>
          <div className="mono tnum" style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.04em' }}>L {total}</div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 6 }}>Ref: {refPedido}</div>
        </div>
      )}
      {esTransferencia && (
        <>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) onSubirComprobante(f); }} />
          <button className="btn btn-outline btn-block" style={{ height: 48, fontSize: 14, marginBottom: 16 }} onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? 'Subiendo...' : comprobanteUrl ? '✓ Comprobante adjuntado' : '↑ Subir comprobante'}
          </button>
        </>
      )}
      <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '14px 16px', marginBottom: 16, background: '#fff' }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
      Devoluciones y Cancelaciones
      </div>
      <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6 }}>
        Una vez procesada la compra NO se puede cancelar la orden. NO hay devoluciones de ningún tipo.
      {tiendaEmail && (
        <> Por favor contactar por correo electrónico a{' '}
        <a href={`mailto:${tiendaEmail}`} style={{ color: 'var(--ink)', fontWeight: 600, textDecoration: 'underline' }}>{tiendaEmail}</a>.
      </>
      )}
      </div>
      </div>
      {errorMsg && <div style={{ fontSize: 13, color: 'var(--urgent)', marginBottom: 12, padding: '10px 14px', background: '#fef2f2', borderRadius: 8 }}>{errorMsg}</div>}
      <button className="btn btn-primary btn-block" style={{ height: 52, fontSize: 15 }} onClick={onConfirmar} disabled={loading || uploading}>
        {loading ? 'Procesando...' : 'Realizar compra'}
      </button>
    </div>
  );
}

function ConfirmadoPanel({ numero, tiendaUsername, onVerPedido, onCerrar }: { numero: string; tiendaUsername: string; onVerPedido: () => void; onCerrar: () => void }) {
  const router = useRouter();
  return (
    <div className="buyer-confirmed-panel" style={{ padding: '60px 40px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ width: 72, height: 72, borderRadius: 36, background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, marginBottom: 24 }}>✓</div>
      <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 8 }}>¡Compra realizada!</div>
      <div style={{ fontSize: 15, color: 'var(--ink-3)', marginBottom: 32, lineHeight: 1.55 }}>
        Tu pedido fue registrado correctamente.<br />Te avisamos por WhatsApp cuando salga tu pedido.
      </div>
      <div style={{ background: 'var(--surface-2)', borderRadius: 12, padding: '18px 32px', marginBottom: 36, width: '100%' }}>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Número de pedido</div>
        <div className="mono tnum" style={{ fontSize: 24, fontWeight: 700 }}>{numero}</div>
      </div>
      <button className="btn btn-primary btn-block" style={{ height: 52, fontSize: 15, marginBottom: 10 }} onClick={onVerPedido}>
        Ver estado del pedido
      </button>
      <button className="btn btn-outline btn-block" style={{ height: 50, fontSize: 14, marginBottom: 10 }} onClick={() => router.push(`/${tiendaUsername}#catalogo`)}>
        Ver más prendas
      </button>
      <button className="btn btn-ghost btn-block" style={{ height: 48, fontSize: 14 }} onClick={onCerrar}>
        Cerrar
      </button>
    </div>
  );
}

function ResumenLineas({ precio, costoEnvio, total }: { precio: number; costoEnvio: number; total: number }) {
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--ink-2)', marginBottom: 6 }}>
        <span>Subtotal</span><span className="mono tnum">L {precio}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--ink-2)', marginBottom: 8 }}>
        <span>Envío</span><span className="mono tnum">{costoEnvio === 0 ? 'Gratis' : `L ${costoEnvio}`}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 700 }}>
        <span>Total</span>
        <span><span style={{ fontSize: 11, color: 'var(--ink-3)', marginRight: 3 }}>HNL</span><span className="mono tnum">L {total}</span></span>
      </div>
    </>
  );
}
