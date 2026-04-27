'use client';

import Image from 'next/image';

import { cld } from '@/lib/cloudinary/client';
import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Icons } from '@/components/shared/icons';
import { Ph } from '@/components/shared/image-placeholder';
import { BuyerCheckoutAccess } from '@/components/buyer/buyer-checkout-access';
import type { BuyerProfile } from '@/components/buyer/buyer-auth-modal';
import { EnvioPanel, PagoPanel, ConfirmadoPanel, ResumenLineas } from '@/components/checkout/checkout-panels';
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
  const [zoomActivo, setZoomActivo] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });

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

  async function compartirPrenda() {
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({ title: prenda.nombre, url });
        return;
      } catch {
        // Si el usuario cancela o el navegador falla, intentamos copiar el link.
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copiado al portapapeles');
    } catch {
      toast.error('No se pudo compartir la prenda');
    }
  }

  function actualizarZoom(event: ReactMouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setZoomPos({
      x: Math.min(100, Math.max(0, x)),
      y: Math.min(100, Math.max(0, y)),
    });
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
          <Image src={cld(tienda.logo_url, 'logo')} alt={tienda.nombre} width={28} height={28} style={{ borderRadius: 14, objectFit: 'cover' }} />
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
                <Image src={cld(f, 'mini')} alt="" fill sizes="72px" style={{ objectFit: 'cover' }} />
              </button>
            )) : [0, 1, 2].map(i => (
              <div key={i} style={{ width: 72, height: 90, borderRadius: 8, overflow: 'hidden', outline: i === fotoIdx ? '2px solid var(--ink)' : '2px solid transparent', outlineOffset: 2 }}>
                <Ph tone={TONES[i % TONES.length]} aspect="4/5" radius={0} />
              </div>
            ))}
          </div>

          <div
            className="buyer-product-media"
            style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', background: '#f5f5f5', cursor: zoomActivo ? 'zoom-out' : 'zoom-in' }}
            onMouseEnter={() => setZoomActivo(true)}
            onMouseLeave={() => setZoomActivo(false)}
            onMouseMove={actualizarZoom}
          >
            {fotos.length > 0 ? (
              <Image
                src={cld(fotos[fotoIdx], 'detail')}
                alt={prenda.nombre}
                fill
                sizes="(max-width: 1024px) 100vw, 600px"
                style={{
                  objectFit: 'cover',
                  display: 'block',
                  transform: zoomActivo ? 'scale(2.1)' : 'scale(1)',
                  transformOrigin: `${zoomPos.x}% ${zoomPos.y}%`,
                  transition: zoomActivo ? 'transform .08s ease-out' : 'transform .22s ease-out',
                }}
              />
            ) : (
              <Ph tone={TONES[0]} aspect="4/5" radius={0} />
            )}
            <button
              type="button"
              aria-label="Compartir prenda"
              onClick={compartirPrenda}
              style={{
                position: 'absolute',
                top: 16,
                right: 16,
                width: 56,
                height: 56,
                borderRadius: 28,
                border: '1px solid rgba(26,23,20,0.06)',
                background: 'rgba(255,255,255,0.94)',
                color: 'var(--ink)',
                boxShadow: '0 12px 30px rgba(26,23,20,0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                zIndex: 2,
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
              }}
            >
              <Icons.share width={24} height={24} />
            </button>
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
                <div style={{ position: 'absolute', top: 82, right: 16, background: prendaEstado === 'vendida' ? 'rgba(10,10,10,0.88)' : 'rgba(180,100,0,0.88)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', color: '#fff', borderRadius: 20, padding: '6px 14px', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
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
                      <Image src={cld(p.fotos[0], 'card')} alt={p.nombre} fill sizes="(max-width: 1024px) 25vw, 200px" style={{ objectFit: 'cover', display: 'block' }} />
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
      {(checkoutStep === 'confirmado' || (checkoutOpen && tieneStock)) && (
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
                compradorNombre={nombre}
                onChange={(f, v) => { if (f === 'metodoPagoId') setMetodoPagoId(v); setErrorMsg(''); }}
                onSubirComprobante={subirComprobante}
                onConfirmar={confirmarApartado}
                onVolver={() => setCheckoutStep('envio')}
              />
            )}
            {checkoutStep === 'confirmado' && (
              <ConfirmadoPanel
                numero={pedidoNumero}
                onVerPedido={() => router.push(pedidoTrackingUrl || `/pedido/${pedidoNumero}`)}
                onCerrar={() => setCheckoutStep('none')}
                secondaryAction={{ label: 'Ver más prendas', onClick: () => router.push(`/${tienda.username}#catalogo`) }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
