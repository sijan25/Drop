'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Icons } from '@/components/shared/icons';
import { BuyerCheckoutAccess } from '@/components/buyer/buyer-checkout-access';
import type { BuyerProfile } from '@/components/buyer/buyer-auth-modal';
import { carritoItemKey, useCarrito } from '@/hooks/use-carrito';
import { obtenerPerfilComprador } from '@/lib/buyer/actions';
import { crearCheckoutPublico } from '@/lib/checkout/actions';
import { PLATFORM, formatCurrency, formatCurrencyFree } from '@/lib/config/platform';
import { obtenerCarrito } from '@/lib/cart/actions';
import { uploadImage } from '@/lib/cloudinary/client';
import { ShippingSelector, BoxfulAddressFields } from '@/components/checkout/checkout-panels';
import { PhoneInput } from '@/components/shared/phone-input';
import type { BoxfulChangeData } from '@/components/checkout/checkout-panels';
import type { BoxfulQuote } from '@/lib/boxful/types';
import type { Tienda } from '@/types/tienda';
import type { MetodoPago, MetodoEnvio } from '@/types/envio';

const BOXFUL_SHIPPING_ID = 'boxful';

export function CarritoCheckoutClient({
  tienda,
  metodosPago,
  metodosEnvio,
  tiendaEmail,
  isOwnerPreview = false,
}: {
  tienda: Tienda;
  metodosPago: MetodoPago[];
  metodosEnvio: MetodoEnvio[];
  tiendaEmail: string;
  isOwnerPreview?: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const { items, total: totalPrendas, limpiar, hidratado } = useCarrito();

  const [step, setStep] = useState<'form' | 'confirmado'>('form');
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [direccion, setDireccion] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [buyer, setBuyer] = useState<BuyerProfile | null>(null);
  const [metodoEnvioId, setMetodoEnvioId] = useState(BOXFUL_SHIPPING_ID);
  const [boxfulData, setBoxfulData] = useState<BoxfulChangeData>({ isBoxful: true, quote: null, destination: null, mode: 'boxful_dropoff' });
  const [metodoPagoId, setMetodoPagoId] = useState(metodosPago[0]?.id ?? '');
  const [uploading, setUploading] = useState(false);
  const [comprobanteUrl, setComprobanteUrl] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pedidosNums, setPedidosNums] = useState<string[]>([]);
  const [pedidoTrackingUrls, setPedidoTrackingUrls] = useState<string[]>([]);

  const metodoEnvioSel = metodosEnvio.find(m => m.id === metodoEnvioId);
  const isBoxfulSelected = metodoEnvioId === BOXFUL_SHIPPING_ID;
  const metodoPagoSel = metodosPago.find(m => m.id === metodoPagoId);
  const costoEnvio = boxfulData.isBoxful ? (boxfulData.quote?.price ?? 0) : (metodoEnvioSel?.precio ?? 0);
  const total = totalPrendas + costoEnvio;
  const esTransferencia = metodoPagoSel?.tipo === 'transferencia';
  const initials = tienda.nombre.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const envioResumen = isBoxfulSelected
    ? (boxfulData.quote ? formatCurrency(boxfulData.quote.price) : 'Seleccioná ciudad')
    : formatCurrencyFree(costoEnvio);

  // Redirigir si carrito vacío
  useEffect(() => {
    if (!hidratado) return;
    if (items.length === 0 && step === 'form') {
      router.replace(`/${tienda.username}`);
    }
  }, [hidratado, items, step, tienda.username, router]);

  // Pre-llenar datos del usuario logueado (nunca en vista previa del dueño)
  useEffect(() => {
    if (isOwnerPreview) return;
    (async () => {
      const res = await obtenerPerfilComprador();
      if (!res.comprador) return;
      aplicarBuyer(res.comprador);
    })();
  }, [isOwnerPreview]);

  function fe(field: string) { return fieldErrors[field]; }
  function clearFe(field: string) { setFieldErrors(p => { const n = { ...p }; delete n[field]; return n; }); }

  function aplicarBuyer(profile: BuyerProfile) {
    setBuyer(profile);
    setNombre(profile.nombre);
    setEmail(profile.email);
    setWhatsapp(profile.telefono ?? '');
    setDireccion(profile.direccion ?? '');
    setCiudad(profile.ciudad ?? '');
    setFieldErrors({});
    setServerError('');
  }

  async function subirComprobante(file: File) {
    setUploading(true);
    try {
      const result = await uploadImage(file, { folder: 'fardodrops/comprobantes' });
      setComprobanteUrl(result.url);
      clearFe('comprobante');
    } catch {
      setFieldErrors(p => ({ ...p, comprobante: 'No se pudo subir el comprobante.' }));
    } finally {
      setUploading(false);
    }
  }

  async function confirmar() {
    const errs: Record<string, string> = {};
    if (!nombre.trim()) errs.nombre = 'Ingresá tu nombre completo.';
    if (!whatsapp.trim()) errs.whatsapp = 'Ingresá tu número de WhatsApp.';
    if (!direccion.trim()) errs.direccion = 'Ingresá tu dirección.';
    if (!ciudad.trim()) errs.ciudad = 'Ingresá tu ciudad.';
    if (!metodoEnvioId) errs.envio = 'Seleccioná un método de envío.';
    if (isBoxfulSelected) {
      if (!boxfulData.destination) errs.envio = 'Seleccioná departamento y ciudad para calcular Boxful.';
      else if (!boxfulData.quote) errs.envio = 'Esperá la cotización de Boxful o elegí otro método.';
    }
    if (!metodoPagoId) errs.pago = 'Seleccioná un método de pago.';
    if (esTransferencia && !comprobanteUrl) errs.comprobante = 'Debés subir el comprobante de transferencia.';

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      const firstKey = Object.keys(errs)[0];
      document.getElementById(`field-${firstKey}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setFieldErrors({});
    setServerError('');
    setLoading(true);

    // Verify stock freshness before submitting — purges stale items server-side
    const freshCart = await obtenerCarrito();
    if (freshCart.error) {
      setServerError('No pudimos verificar el stock. Intentá de nuevo.');
      setLoading(false);
      return;
    }
    const freshKeys = new Set(freshCart.items.map(i => carritoItemKey(i.prendaId, i.talla)));
    const staleItems = items.filter(i => !freshKeys.has(carritoItemKey(i.prendaId, i.talla)));
    if (staleItems.length > 0) {
      const nombres = staleItems.map(i => `"${i.nombre}"`).join(', ');
      setServerError(`${nombres} ${staleItems.length === 1 ? 'ya no está disponible' : 'ya no están disponibles'}. Volvé al carrito para ver las prendas actualizadas.`);
      setLoading(false);
      return;
    }

    const res = await crearCheckoutPublico({
      tiendaId: tienda.id,
      dropId: null,
      items: items.map(item => ({ prendaId: item.prendaId, talla: item.talla })),
      nombre: nombre.trim(),
      email: email.trim() || null,
      whatsapp: whatsapp.trim(),
      direccion: direccion.trim(),
      ciudad: isBoxfulSelected && boxfulData.destination ? boxfulData.destination.cityName : ciudad.trim(),
      metodoEnvioId: isBoxfulSelected ? null : metodoEnvioId,
      metodoPagoId,
      comprobanteUrl,
      envioBoxful: isBoxfulSelected && boxfulData.quote && boxfulData.destination ? {
        mode: boxfulData.mode,
        quote: boxfulData.quote,
        destination: boxfulData.destination,
        originCityName: tienda.ciudad ?? PLATFORM.defaultCity,
      } : undefined,
    });

    if (res.error || !res.pedido) {
      setServerError(res.error ?? 'No pudimos crear el pedido. Intentá de nuevo.');
      setLoading(false);
      return;
    }

    setPedidosNums([res.pedido.numero]);
    setPedidoTrackingUrls([res.pedido.trackingUrl]);
    setStep('confirmado');
    limpiar();
    setLoading(false);
  }

  if (!hidratado && step === 'form') {
    return (
      <div style={{ minHeight: '100vh', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ fontSize: 14, color: 'var(--ink-3)' }}>Preparando tu carrito...</div>
      </div>
    );
  }

  if (step === 'confirmado') {
    return (
      <div style={{ minHeight: '100vh', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
          <div style={{ width: 72, height: 72, borderRadius: 36, background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, margin: '0 auto 24px' }}>✓</div>
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 8 }}>¡Compra realizada!</div>
          <div style={{ fontSize: 15, color: 'var(--ink-3)', marginBottom: 32, lineHeight: 1.55 }}>
            {pedidosNums.length > 1
              ? `Se crearon ${pedidosNums.length} pedidos. Te avisamos por WhatsApp.`
              : 'Tu pedido fue registrado. Te avisamos por WhatsApp.'}
          </div>
          <div style={{ background: 'var(--surface-2)', borderRadius: 12, padding: '18px 24px', marginBottom: 32 }}>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
              {pedidosNums.length > 1 ? 'Números de pedido' : 'Número de pedido'}
            </div>
            {pedidosNums.map(n => (
              <div key={n} className="mono tnum" style={{ fontSize: 20, fontWeight: 700 }}>{n}</div>
            ))}
          </div>
          {pedidosNums.length === 1 && (
            <button className="btn btn-primary btn-block" style={{ height: 52, fontSize: 15, marginBottom: 10 }}
              onClick={() => router.push(pedidoTrackingUrls[0] ?? `/pedido/${pedidosNums[0]}`)}>
              Ver estado del pedido
            </button>
          )}
          <button className="btn btn-outline btn-block" style={{ height: 50, fontSize: 14 }}
            onClick={() => router.push(`/${tienda.username}`)}>
            Volver a la tienda
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="buyer-cart-page" style={{ minHeight: '100vh', background: '#fff' }}>
      {isOwnerPreview && (
        <div style={{
          position: 'sticky', top: 0, zIndex: 999,
          background: '#111', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 20px', gap: 12, fontSize: 13,
        }}>
          <span style={{ opacity: 0.7 }}>Vista previa de tu tienda — los clientes no ven este aviso</span>
          <button
            onClick={() => router.push('/dashboard')}
            style={{ background: '#fff', color: '#111', border: 'none', borderRadius: 8, padding: '6px 14px', fontWeight: 700, fontSize: 12, cursor: 'pointer', flexShrink: 0 }}
          >
            ← Volver al dashboard
          </button>
        </div>
      )}
      {/* NAV */}
      <nav className="buyer-product-nav" style={{
        position: 'sticky', top: 0, zIndex: 40, background: '#fff',
        borderBottom: '1px solid var(--line)',
        padding: '0 40px', height: 56,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div className="buyer-product-nav-left" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => router.back()}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 13, padding: 0 }}>
            <Icons.back width={16} height={16} />
            Volver
          </button>
          <span style={{ color: 'var(--line)', margin: '0 8px' }}>·</span>
          <span className="buyer-product-breadcrumb" style={{ fontSize: 13, color: 'var(--ink-3)' }}>
            <Link href={`/${tienda.username}`} style={{ color: 'inherit', textDecoration: 'none' }}>{tienda.nombre}</Link>
            {' / '}
            <span style={{ color: 'var(--ink)' }}>Carrito</span>
          </span>
        </div>
        {tienda.logo_url
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={tienda.logo_url} alt={tienda.nombre} style={{ width: 28, height: 28, borderRadius: 14, objectFit: 'cover' }} />
          : <div style={{ width: 28, height: 28, borderRadius: 14, background: '#e4d4d0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{initials}</div>
        }
      </nav>

      {/* LAYOUT DOS COLUMNAS */}
      <div className="buyer-cart-main" style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px', display: 'grid', gridTemplateColumns: '1fr 420px', gap: 64, alignItems: 'start' }}>

        {/* COLUMNA IZQUIERDA — formulario */}
        <div>
          {/* Contacto */}
          <section style={{ marginBottom: 32 }}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.015em' }}>Contacto</div>
            </div>
            {!isOwnerPreview && (
              <BuyerCheckoutAccess
                buyer={buyer}
                onBuyer={aplicarBuyer}
                onLogout={() => setBuyer(null)}
              />
            )}
            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <input
                  id="checkout-email"
                  className="input input-lg"
                  type="email"
                  placeholder="Correo electrónico"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setServerError(''); }}
                />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, color: 'var(--ink-2)' }}>
                <input
                  type="checkbox"
                  defaultChecked
                  style={{ width: 16, height: 16, accentColor: 'var(--ink)', cursor: 'pointer', flexShrink: 0 }}
                />
                Enviarme novedades y ofertas por correo electrónico
              </label>
              <div id="field-nombre">
                <label className="label">Nombre completo</label>
                <input className="input input-lg" placeholder="Karla Morales" value={nombre}
                  onChange={e => { setNombre(e.target.value); clearFe('nombre'); }}
                  style={fe('nombre') ? { borderColor: 'var(--urgent)' } : undefined} />
                {fe('nombre') && <div style={{ marginTop: 4, fontSize: 12, color: 'var(--urgent)' }}>{fe('nombre')}</div>}
              </div>
              <div id="field-whatsapp">
                <label className="label">WhatsApp</label>
                <PhoneInput value={whatsapp} onChange={v => { setWhatsapp(v); clearFe('whatsapp'); }} size="lg" />
                {fe('whatsapp') && <div style={{ marginTop: 4, fontSize: 12, color: 'var(--urgent)' }}>{fe('whatsapp')}</div>}
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: -4 }}>Te avisamos por WhatsApp y email cuando salgan tus pedidos</div>
            </div>
          </section>

          {/* Entrega */}
          <section style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.015em', marginBottom: 16 }}>Entrega</div>
            <div style={{ display: 'grid', gap: 12 }}>
              <div id="field-direccion">
                <label className="label">Dirección</label>
                <input className="input input-lg" placeholder="Col. Kennedy, Calle 5, Casa 12" value={direccion}
                  onChange={e => { setDireccion(e.target.value); clearFe('direccion'); }}
                  style={fe('direccion') ? { borderColor: 'var(--urgent)' } : undefined} />
                {fe('direccion') && <div style={{ marginTop: 4, fontSize: 12, color: 'var(--urgent)' }}>{fe('direccion')}</div>}
              </div>
              {metodoEnvioId === BOXFUL_SHIPPING_ID ? (
                <div id="field-ciudad">
                  <BoxfulAddressFields
                    originCity={tienda.ciudad}
                    itemsCount={items.length}
                    subtotal={totalPrendas}
                    onBoxfulChange={data => { setBoxfulData(data); clearFe('envio'); clearFe('ciudad'); }}
                    onCiudadChange={setCiudad}
                  />
                  {fe('ciudad') && <div style={{ marginTop: 4, fontSize: 12, color: 'var(--urgent)' }}>{fe('ciudad')}</div>}
                </div>
              ) : (
                <div className="buyer-checkout-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div id="field-ciudad">
                    <label className="label">Ciudad</label>
                    <input className="input input-lg" placeholder={PLATFORM.defaultCity} value={ciudad}
                      onChange={e => { setCiudad(e.target.value); clearFe('ciudad'); }}
                      style={fe('ciudad') ? { borderColor: 'var(--urgent)' } : undefined} />
                    {fe('ciudad') && <div style={{ marginTop: 4, fontSize: 12, color: 'var(--urgent)' }}>{fe('ciudad')}</div>}
                  </div>
                  <div>
                    <label className="label">País</label>
                    <input className="input input-lg" value={PLATFORM.country} readOnly style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }} />
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Métodos de envío */}
          <section style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.015em', marginBottom: 16 }}>Método de envío</div>
            <ShippingSelector
              metodosEnvio={metodosEnvio}
              metodoEnvioId={metodoEnvioId}
              boxfulQuote={boxfulData.quote}
              onChange={id => {
                setMetodoEnvioId(id);
                clearFe('envio');
                if (id !== BOXFUL_SHIPPING_ID) setBoxfulData({ isBoxful: false, quote: null, destination: null, mode: 'boxful_dropoff' });
              }}
            />
            {fe('envio') && <div style={{ marginTop: 8, fontSize: 12, color: 'var(--urgent)' }}>{fe('envio')}</div>}
          </section>

          {/* Método de pago */}
          <section style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.015em', marginBottom: 16 }}>Método de pago</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {metodosPago.map(m => (
                <label key={m.id} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 16px',
                  border: `1.5px solid ${metodoPagoId === m.id ? 'var(--ink)' : 'var(--line)'}`,
                  borderRadius: 12, cursor: 'pointer', background: '#fff',
                }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icons.bank width={18} height={18} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{m.proveedor}</div>
                    {m.detalle && <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{m.detalle}</div>}
                  </div>
                  <input type="radio" name="pago" checked={metodoPagoId === m.id} onChange={() => setMetodoPagoId(m.id)}
                    style={{ accentColor: 'var(--ink)', width: 16, height: 16 }} />
                </label>
              ))}
              {/* Tarjeta — próximamente */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', border: '1.5px solid var(--line)', borderRadius: 12, background: 'var(--surface-2)', opacity: 0.6 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: '#e8e8e8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icons.card width={18} height={18} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                    Pagar con tarjeta
                    <span style={{ fontSize: 10, fontWeight: 600, background: 'var(--ink-3)', color: '#fff', padding: '2px 7px', borderRadius: 20 }}>Próximamente</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Visa · Mastercard</div>
                </div>
              </div>
            </div>

            {/* Comprobante */}
            {esTransferencia && (
              <div style={{ marginTop: 16 }}>
                <div style={{ background: 'var(--surface-2)', borderRadius: 12, padding: '16px 18px', marginBottom: 12 }}>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 6 }}>Transferí el total exacto:</div>
                  <div className="mono tnum" style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.04em' }}>{formatCurrency(total)}</div>
                </div>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) subirComprobante(f); }} />
                <div id="field-comprobante">
                  <button className="btn btn-block" style={{
                    height: 48, fontSize: 14,
                    border: `1.5px solid ${fe('comprobante') ? 'var(--urgent)' : comprobanteUrl ? '#16a34a' : 'var(--line)'}`,
                    borderRadius: 12,
                    background: comprobanteUrl ? '#f0fdf4' : '#fff',
                    color: comprobanteUrl ? '#15803d' : 'var(--ink)',
                  }}
                    onClick={() => fileRef.current?.click()} disabled={uploading}>
                    {uploading ? 'Subiendo...' : comprobanteUrl ? '✓ Comprobante adjuntado' : '↑ Subir comprobante'}
                  </button>
                  {fe('comprobante') && <div style={{ marginTop: 6, fontSize: 12, color: 'var(--urgent)' }}>{fe('comprobante')}</div>}
                </div>
              </div>
            )}
          </section>

          {/* Política */}
          <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '14px 16px', marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Devoluciones y Cancelaciones</div>
            <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6 }}>
              Una vez procesada la compra NO se puede cancelar la orden. NO hay devoluciones de ningún tipo.
              {tiendaEmail && (
                <> Por favor contactar por correo electrónico a{' '}
                  <a href={`mailto:${tiendaEmail}`} style={{ color: 'var(--ink)', fontWeight: 600, textDecoration: 'underline' }}>{tiendaEmail}</a>.
                </>
              )}
            </div>
          </div>

          {serverError && (
            <div style={{ fontSize: 13, color: 'var(--urgent)', marginBottom: 16, padding: '10px 14px', background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca' }}>
              {serverError}
            </div>
          )}

          <button className="btn btn-primary btn-block" style={{ height: 56, fontSize: 16, fontWeight: 600, borderRadius: 14 }}
            onClick={confirmar} disabled={loading || uploading}>
            {loading ? 'Procesando...' : `Finalizar compra · ${formatCurrency(total)}`}
          </button>
        </div>

        {/* COLUMNA DERECHA — resumen */}
        <div className="buyer-cart-summary" style={{ position: 'sticky', top: 72 }}>
          <div style={{ border: '1px solid var(--line)', borderRadius: 16, overflow: 'hidden' }}>
            {/* Prendas */}
            <div style={{ padding: '20px 20px 0' }}>
              {items.map(item => (
                <div key={carritoItemKey(item.prendaId, item.talla)} className="buyer-cart-summary-item" style={{
                  display: 'grid', gridTemplateColumns: '64px 1fr auto',
                  gap: 12, alignItems: 'center', marginBottom: 16,
                }}>
                  <div style={{ position: 'relative' }}>
                    <div style={{ width: 64, height: 80, borderRadius: 10, overflow: 'hidden', background: 'var(--surface-2)' }}>
                      {item.foto
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={item.foto} alt={item.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <div style={{ width: '100%', height: '100%', background: '#eee' }} />}
                    </div>
                    <div style={{
                      position: 'absolute', top: -6, right: -6,
                      width: 20, height: 20, borderRadius: 10,
                      background: '#555', color: '#fff',
                      fontSize: 11, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>1</div>
                  </div>
                  <div>
                    {item.marca && <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.marca}</div>}
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{item.nombre}</div>
                    {item.talla && <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Talla {item.talla}</div>}
                  </div>
                  <div className="mono tnum" style={{ fontSize: 14, fontWeight: 600 }}>{formatCurrency(item.precio)}</div>
                </div>
              ))}
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '4px 0' }} />

            {/* Totales */}
            <div style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--ink-2)', marginBottom: 8 }}>
                <span>Subtotal · {items.length} {items.length === 1 ? 'prenda' : 'prendas'}</span>
                <span className="mono tnum">{formatCurrency(totalPrendas)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--ink-2)', marginBottom: 12 }}>
                <span>Envío</span>
                <span className="mono tnum">{envioResumen}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 16, fontWeight: 700 }}>Total</span>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: 11, color: 'var(--ink-3)', marginRight: 4 }}>{PLATFORM.currency}</span>
                  <span className="mono tnum" style={{ fontSize: 22, fontWeight: 800 }}>{formatCurrency(total)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
