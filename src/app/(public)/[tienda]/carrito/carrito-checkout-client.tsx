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
import { getTiendaConfig, formatCurrencyTienda, formatCurrencyFreeTienda } from '@/lib/config/platform';
import { obtenerCarrito } from '@/lib/cart/actions';
import { uploadImage } from '@/lib/cloudinary/client';
import { ShippingSelector, BoxfulAddressFields, CheckoutProcessingOverlay } from '@/components/checkout/checkout-panels';
import { PhoneInput, isoFromPhoneCode } from '@/components/shared/phone-input';
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
  const [cardData, setCardData] = useState({ number: '', holder: '', expireMonth: '', expireYear: '', cvv: '', billingAddress: '', billingCity: '', billingState: 'HN-CR', billingPhone: '' });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  const [pedidosNums, setPedidosNums] = useState<string[]>([]);
  const [pedidoTrackingUrls, setPedidoTrackingUrls] = useState<string[]>([]);

  const tiendaConfig = getTiendaConfig(tienda);
  const simbolo = tiendaConfig.simbolo_moneda;
  const metodoEnvioSel = metodosEnvio.find(m => m.id === metodoEnvioId);
  const isBoxfulSelected = metodoEnvioId === BOXFUL_SHIPPING_ID;
  const metodoPagoSel = metodosPago.find(m => m.id === metodoPagoId);
  const costoEnvio = boxfulData.isBoxful ? (boxfulData.quote?.price ?? 0) : (metodoEnvioSel?.precio ?? 0);
  const total = totalPrendas + costoEnvio;
  const esTransferencia = metodoPagoSel?.tipo === 'transferencia';
  const esPixelPay = metodoPagoSel?.tipo === 'tarjeta' && metodoPagoSel?.proveedor?.toLowerCase().includes('pixelpay');
  const initials = tienda.nombre.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const envioResumen = isBoxfulSelected
    ? (boxfulData.quote ? formatCurrencyTienda(boxfulData.quote.price, simbolo) : 'Seleccioná ciudad')
    : formatCurrencyFreeTienda(costoEnvio, simbolo);

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
    if (loading || uploading) return;

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
    if (esPixelPay) {
      if (!cardData.number.trim()) errs.card_number = 'Ingresá el número de tarjeta.';
      if (!cardData.holder.trim()) errs.card_holder = 'Ingresá el nombre del titular.';
      if (!cardData.expireMonth.trim() || !cardData.expireYear.trim()) errs.card_expire = 'Ingresá la fecha de vencimiento.';
      if (!cardData.cvv.trim()) errs.card_cvv = 'Ingresá el CVV.';
      if (!cardData.billingAddress.trim()) errs.card_address = 'Ingresá tu dirección de facturación.';
      if (!cardData.billingCity.trim()) errs.card_city = 'Ingresá tu ciudad de facturación.';
      if (!cardData.billingPhone.trim()) errs.card_phone = 'Ingresá tu teléfono.';
    }

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      const firstKey = Object.keys(errs)[0];
      document.getElementById(`field-${firstKey}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setFieldErrors({});
    setServerError('');
    setProcessingMessage('Estamos verificando que las prendas sigan disponibles.');
    setLoading(true);

    // Verify stock freshness before submitting — purges stale items server-side
    const freshCart = await obtenerCarrito();
    if (freshCart.error) {
      setServerError('No pudimos verificar el stock. Intentá de nuevo.');
      setLoading(false);
      setProcessingMessage('');
      return;
    }
    const freshKeys = new Set(freshCart.items.map(i => carritoItemKey(i.prendaId, i.talla)));
    const staleItems = items.filter(i => !freshKeys.has(carritoItemKey(i.prendaId, i.talla)));
    if (staleItems.length > 0) {
      const nombres = staleItems.map(i => `"${i.nombre}"`).join(', ');
      setServerError(`${nombres} ${staleItems.length === 1 ? 'ya no está disponible' : 'ya no están disponibles'}. Volvé al carrito para ver las prendas actualizadas.`);
      setLoading(false);
      setProcessingMessage('');
      return;
    }

    setProcessingMessage(esPixelPay
      ? 'Procesando tu pago con tarjeta de forma segura.'
      : 'Registrando tu compra y reservando tus prendas.'
    );
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
      pixelPayCard: esPixelPay ? {
        number: cardData.number.replace(/\s/g, ''),
        holder: cardData.holder,
        expireMonth: cardData.expireMonth,
        expireYear: cardData.expireYear.length === 2 ? `20${cardData.expireYear}` : cardData.expireYear,
        cvv: cardData.cvv,
        billingAddress: cardData.billingAddress || direccion,
        billingCity: cardData.billingCity || ciudad,
        billingState: cardData.billingState,
        billingPhone: cardData.billingPhone || whatsapp,
      } : null,
      envioBoxful: isBoxfulSelected && boxfulData.quote && boxfulData.destination ? {
        mode: boxfulData.mode,
        quote: boxfulData.quote,
        destination: boxfulData.destination,
        originCityName: tienda.ciudad ?? null,
      } : undefined,
    });

    if (res.error || !res.pedido) {
      setServerError(res.error ?? 'No pudimos crear el pedido. Intentá de nuevo.');
      setLoading(false);
      setProcessingMessage('');
      return;
    }

    setProcessingMessage('Compra confirmada. Preparando el resumen del pedido.');
    setPedidosNums([res.pedido.numero]);
    setPedidoTrackingUrls([res.pedido.trackingUrl]);
    setStep('confirmado');
    limpiar();
    setLoading(false);
    setProcessingMessage('');
  }

  if (!hidratado && step === 'form') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
        <div className="text-[14px] text-[var(--ink-3)]">Preparando tu carrito...</div>
      </div>
    );
  }

  if (step === 'confirmado') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
        <div className="max-w-[480px] w-full text-center">
          <div className="w-[72px] h-[72px] rounded-full bg-[#ecfdf5] flex items-center justify-center text-[32px] mx-auto mb-6">✓</div>
          <div className="text-[26px] font-bold tracking-[-0.02em] mb-2">¡Compra realizada!</div>
          <div className="text-[15px] text-[var(--ink-3)] mb-8 leading-[1.55]">
            {pedidosNums.length > 1
              ? `Se crearon ${pedidosNums.length} pedidos. Te avisamos por WhatsApp.`
              : 'Tu pedido fue registrado. Te avisamos por WhatsApp.'}
          </div>
          <div className="bg-[var(--surface-2)] rounded-[12px] px-6 py-[18px] mb-8">
            <div className="text-[11px] text-[var(--ink-3)] uppercase tracking-[0.06em] mb-[10px]">
              {pedidosNums.length > 1 ? 'Números de pedido' : 'Número de pedido'}
            </div>
            {pedidosNums.map(n => (
              <div key={n} className="mono tnum text-[20px] font-bold">{n}</div>
            ))}
          </div>
          {pedidosNums.length === 1 && (
            <button className="btn btn-primary btn-block h-[52px] text-[15px] mb-[10px]"
              onClick={() => router.push(pedidoTrackingUrls[0] ?? `/pedido/${pedidosNums[0]}`)}>
              Ver estado del pedido
            </button>
          )}
          <button className="btn btn-outline btn-block h-[50px] text-[14px]"
            onClick={() => router.push(`/${tienda.username}`)}>
            Volver a la tienda
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="buyer-cart-page relative min-h-screen bg-white">
      {loading && (
        <div className="fixed inset-0 z-[1000]">
          <CheckoutProcessingOverlay
            message={processingMessage || 'Estamos procesando tu compra.'}
            total={total}
            simbolo={simbolo}
          />
        </div>
      )}
      {isOwnerPreview && (
        <div className="buyer-preview-bar sticky top-0 z-[999] bg-[#111] text-white flex items-center justify-between px-5 py-[10px] gap-3 text-[13px]">
          <span className="opacity-70 min-w-0">Vista previa de tu tienda — los clientes no ven este aviso</span>
          <button
            onClick={() => router.push('/dashboard')}
            className="bg-white text-[#111] border-none rounded-lg px-[14px] py-[6px] font-bold text-[12px] cursor-pointer shrink-0"
          >
            ← Volver al dashboard
          </button>
        </div>
      )}
      {/* NAV */}
      <nav className="buyer-product-nav sticky top-0 z-40 bg-white border-b border-[var(--line)] px-10 h-14 flex items-center justify-between">
        <div className="buyer-product-nav-left flex items-center gap-2 min-w-0">
          <button onClick={() => router.back()}
            className="flex items-center gap-[6px] bg-none border-none cursor-pointer text-[var(--ink-3)] text-[13px] p-0">
            <Icons.back width={16} height={16} />
            Volver
          </button>
          <span className="text-[var(--line)] mx-2">·</span>
          <span className="buyer-product-breadcrumb text-[13px] text-[var(--ink-3)]">
            <Link href={`/${tienda.username}`} className="text-inherit no-underline">{tienda.nombre}</Link>
            {' / '}
            <span className="text-[var(--ink)]">Carrito</span>
          </span>
        </div>
        {tienda.logo_url
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={tienda.logo_url} alt={tienda.nombre} className="w-7 h-7 rounded-[14px] object-cover" />
          : <div className="w-7 h-7 rounded-[14px] bg-[#e4d4d0] flex items-center justify-center text-[11px] font-bold">{initials}</div>
        }
      </nav>

      {/* LAYOUT DOS COLUMNAS */}
      <div className="buyer-cart-main w-full max-w-[1100px] mx-auto px-6 py-10 grid gap-16 items-start grid-cols-[minmax(0,1fr)_420px]">

        {/* COLUMNA IZQUIERDA — formulario */}
        <div className="min-w-0">
          {/* Contacto */}
          <section className="mb-8">
            <div className="mb-4">
              <div className="text-[20px] font-bold tracking-[-0.015em]">Contacto</div>
            </div>
            {!isOwnerPreview && (
              <BuyerCheckoutAccess
                buyer={buyer}
                onBuyer={aplicarBuyer}
                onLogout={() => setBuyer(null)}
              />
            )}
            <div className="grid gap-3">
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
              <label className="flex items-start gap-[10px] cursor-pointer text-[13px] text-[var(--ink-2)] leading-[1.35]">
                <input
                  type="checkbox"
                  defaultChecked
                  className="w-4 h-4 accent-[var(--ink)] cursor-pointer shrink-0"
                />
                Enviarme novedades y ofertas por correo electrónico
              </label>
              <div id="field-nombre">
                <label className="label">Nombre completo</label>
                <input className={`input input-lg${fe('nombre') ? ' border-[var(--urgent)]' : ''}`} placeholder="Karla Morales" value={nombre}
                  onChange={e => { setNombre(e.target.value); clearFe('nombre'); }} />
                {fe('nombre') && <div className="mt-1 text-[12px] text-[var(--urgent)]">{fe('nombre')}</div>}
              </div>
              <div id="field-whatsapp">
                <label className="label">WhatsApp</label>
                <PhoneInput value={whatsapp} onChange={v => { setWhatsapp(v); clearFe('whatsapp'); }} size="lg" defaultCountry={isoFromPhoneCode(tiendaConfig.codigo_telefono)} />
                {fe('whatsapp') && <div className="mt-1 text-[12px] text-[var(--urgent)]">{fe('whatsapp')}</div>}
              </div>
              <div className="text-[12px] text-[var(--ink-3)] -mt-1">Te avisamos por WhatsApp y email cuando salgan tus pedidos</div>
            </div>
          </section>

          {/* Entrega */}
          <section className="mb-8">
            <div className="text-[20px] font-bold tracking-[-0.015em] mb-4">Entrega</div>
            <div className="grid gap-3">
              <div id="field-direccion">
                <label className="label">Dirección</label>
                <input className={`input input-lg${fe('direccion') ? ' border-[var(--urgent)]' : ''}`} placeholder="Col. Kennedy, Calle 5, Casa 12" value={direccion}
                  onChange={e => { setDireccion(e.target.value); clearFe('direccion'); }} />
                {fe('direccion') && <div className="mt-1 text-[12px] text-[var(--urgent)]">{fe('direccion')}</div>}
              </div>
              {metodoEnvioId === BOXFUL_SHIPPING_ID ? (
                <div id="field-ciudad">
                  <BoxfulAddressFields
                    tiendaId={tienda.id}
                    prendaId={items[0]?.prendaId}
                    originCity={tienda.ciudad}
                    itemsCount={items.length}
                    subtotal={totalPrendas}
                    simbolo={simbolo}
                    onBoxfulChange={data => { setBoxfulData(data); clearFe('envio'); clearFe('ciudad'); }}
                    onCiudadChange={setCiudad}
                  />
                  {fe('ciudad') && <div className="mt-1 text-[12px] text-[var(--urgent)]">{fe('ciudad')}</div>}
                </div>
              ) : (
                <div className="buyer-checkout-two-col grid grid-cols-2 gap-3">
                  <div id="field-ciudad">
                    <label className="label">Ciudad</label>
                    <input className={`input input-lg${fe('ciudad') ? ' border-[var(--urgent)]' : ''}`} placeholder="Tu ciudad" value={ciudad}
                      onChange={e => { setCiudad(e.target.value); clearFe('ciudad'); }} />
                    {fe('ciudad') && <div className="mt-1 text-[12px] text-[var(--urgent)]">{fe('ciudad')}</div>}
                  </div>
                  <div>
                    <label className="label">País</label>
                    <input className="input input-lg bg-[var(--surface-2)] text-[var(--ink-3)]" value={tiendaConfig.pais} readOnly />
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Métodos de envío */}
          <section className="mb-8">
            <div className="text-[20px] font-bold tracking-[-0.015em] mb-4">Método de envío</div>
            <ShippingSelector
              metodosEnvio={metodosEnvio}
              metodoEnvioId={metodoEnvioId}
              boxfulQuote={boxfulData.quote}
              simbolo={simbolo}
              onChange={id => {
                setMetodoEnvioId(id);
                clearFe('envio');
                if (id !== BOXFUL_SHIPPING_ID) setBoxfulData({ isBoxful: false, quote: null, destination: null, mode: 'boxful_dropoff' });
              }}
            />
            {fe('envio') && <div className="mt-2 text-[12px] text-[var(--urgent)]">{fe('envio')}</div>}
          </section>

          {/* Método de pago */}
          <section className="mb-8">
            <div className="text-[20px] font-bold tracking-[-0.015em] mb-4">Método de pago</div>
            <div className="grid gap-[10px]">
              {metodosPago.map(m => {
                const isCard = m.tipo === 'tarjeta' && m.proveedor?.toLowerCase().includes('pixelpay');
                return (
                  <label key={m.id} className={`flex items-center gap-[14px] px-4 py-[14px] rounded-[12px] cursor-pointer bg-white border-[1.5px] ${metodoPagoId === m.id ? 'border-[var(--ink)]' : 'border-[var(--line)]'}`}>
                    <div className="w-9 h-9 rounded-lg bg-[var(--surface-2)] flex items-center justify-center shrink-0">
                      {isCard ? <Icons.card width={18} height={18} /> : <Icons.bank width={18} height={18} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-semibold">{m.nombre || m.proveedor}</div>
                      {isCard
                        ? <div className="text-[12px] text-[var(--ink-3)]">Visa · Mastercard · 3.9% + L5</div>
                        : m.detalle && <div className="text-[12px] text-[var(--ink-3)]">{m.detalle}</div>
                      }
                    </div>
                    <input type="radio" name="pago" checked={metodoPagoId === m.id} onChange={() => setMetodoPagoId(m.id)}
                      className="accent-[var(--ink)] w-4 h-4" />
                  </label>
                );
              })}
            </div>

            {/* Formulario de tarjeta PixelPay */}
            {esPixelPay && (
              <div className="mt-4 border border-[var(--line)] rounded-[14px] p-4 grid gap-3 bg-[var(--surface-2)]">
                <div className="text-[13px] font-semibold text-[var(--ink-2)] mb-[2px]">Datos de la tarjeta</div>
                <div id="field-card_number">
                  <label className="label">Número de tarjeta</label>
                  <input className={`input input-lg mono tnum${fieldErrors.card_number ? ' border-[var(--urgent)]' : ''}`}
                    placeholder="4111 1111 1111 1111" maxLength={19} inputMode="numeric"
                    value={cardData.number}
                    onChange={e => {
                      const v = e.target.value.replace(/\D/g, '').slice(0, 16);
                      setCardData(d => ({ ...d, number: v.replace(/(.{4})/g, '$1 ').trim() }));
                      clearFe('card_number');
                    }} />
                  {fieldErrors.card_number && <div className="mt-1 text-[12px] text-[var(--urgent)]">{fieldErrors.card_number}</div>}
                </div>
                <div id="field-card_holder">
                  <label className="label">Nombre en la tarjeta</label>
                  <input className={`input input-lg${fieldErrors.card_holder ? ' border-[var(--urgent)]' : ''}`}
                    placeholder="KARLA MORALES" value={cardData.holder}
                    onChange={e => { setCardData(d => ({ ...d, holder: e.target.value.toUpperCase() })); clearFe('card_holder'); }} />
                  {fieldErrors.card_holder && <div className="mt-1 text-[12px] text-[var(--urgent)]">{fieldErrors.card_holder}</div>}
                </div>
                <div className="buyer-card-two-col grid grid-cols-2 gap-3">
                  <div id="field-card_expire">
                    <label className="label">Vence (MM/AA)</label>
                    <input className={`input input-lg mono tnum${fieldErrors.card_expire ? ' border-[var(--urgent)]' : ''}`}
                      placeholder="12/28" maxLength={5} inputMode="numeric"
                      value={cardData.expireMonth && cardData.expireYear ? `${cardData.expireMonth}/${cardData.expireYear}` : cardData.expireMonth}
                      onChange={e => {
                        const raw = e.target.value.replace(/\D/g, '').slice(0, 4);
                        const mm = raw.slice(0, 2);
                        const yy = raw.slice(2);
                        setCardData(d => ({ ...d, expireMonth: mm, expireYear: yy }));
                        clearFe('card_expire');
                      }} />
                    {fieldErrors.card_expire && <div className="mt-1 text-[12px] text-[var(--urgent)]">{fieldErrors.card_expire}</div>}
                  </div>
                  <div id="field-card_cvv">
                    <label className="label">CVV</label>
                    <input className={`input input-lg mono tnum${fieldErrors.card_cvv ? ' border-[var(--urgent)]' : ''}`}
                      placeholder="123" maxLength={4} inputMode="numeric" type="password"
                      value={cardData.cvv}
                      onChange={e => { setCardData(d => ({ ...d, cvv: e.target.value.replace(/\D/g, '').slice(0, 4) })); clearFe('card_cvv'); }} />
                    {fieldErrors.card_cvv && <div className="mt-1 text-[12px] text-[var(--urgent)]">{fieldErrors.card_cvv}</div>}
                  </div>
                </div>
                <div id="field-card_address">
                  <label className="label">Dirección de facturación</label>
                  <input className={`input input-lg${fieldErrors.card_address ? ' border-[var(--urgent)]' : ''}`}
                    placeholder="Col. Kennedy, Calle 5" value={cardData.billingAddress || direccion}
                    onChange={e => { setCardData(d => ({ ...d, billingAddress: e.target.value })); clearFe('card_address'); }} />
                  {fieldErrors.card_address && <div className="mt-1 text-[12px] text-[var(--urgent)]">{fieldErrors.card_address}</div>}
                </div>
                <div className="buyer-card-two-col grid grid-cols-2 gap-3">
                  <div id="field-card_city">
                    <label className="label">Ciudad</label>
                    <input className={`input input-lg${fieldErrors.card_city ? ' border-[var(--urgent)]' : ''}`}
                      placeholder="San Pedro Sula" value={cardData.billingCity || ciudad}
                      onChange={e => { setCardData(d => ({ ...d, billingCity: e.target.value })); clearFe('card_city'); }} />
                    {fieldErrors.card_city && <div className="mt-1 text-[12px] text-[var(--urgent)]">{fieldErrors.card_city}</div>}
                  </div>
                  <div id="field-card_phone">
                    <label className="label">Teléfono</label>
                    <input className={`input input-lg mono tnum${fieldErrors.card_phone ? ' border-[var(--urgent)]' : ''}`}
                      placeholder="99999999" inputMode="numeric"
                      value={cardData.billingPhone || whatsapp}
                      onChange={e => { setCardData(d => ({ ...d, billingPhone: e.target.value.replace(/\D/g, '') })); clearFe('card_phone'); }} />
                    {fieldErrors.card_phone && <div className="mt-1 text-[12px] text-[var(--urgent)]">{fieldErrors.card_phone}</div>}
                  </div>
                </div>
                <div className="text-[11px] text-[var(--ink-3)] flex items-center gap-[6px] mt-[2px]">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  Pago seguro procesado por PixelPay
                </div>
              </div>
            )}

            {/* Comprobante */}
            {esTransferencia && (
              <div className="mt-4">
                <div className="bg-[var(--surface-2)] rounded-[12px] px-[18px] py-4 mb-3">
                  <div className="text-[12px] text-[var(--ink-3)] mb-[6px]">Transferí el total exacto:</div>
                  <div className="mono tnum text-[32px] font-bold tracking-[-0.04em]">{formatCurrencyTienda(total, simbolo)}</div>
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) subirComprobante(f); }} />
                <div id="field-comprobante">
                  <button
                    className={`btn btn-block h-[48px] text-[14px] rounded-[12px] border-[1.5px] ${fe('comprobante') ? 'border-[var(--urgent)]' : comprobanteUrl ? 'border-[#16a34a] bg-[#f0fdf4] text-[#15803d]' : 'border-[var(--line)] bg-white text-[var(--ink)]'}`}
                    onClick={() => fileRef.current?.click()} disabled={uploading}>
                    {uploading ? 'Subiendo...' : comprobanteUrl ? '✓ Comprobante adjuntado' : '↑ Subir comprobante'}
                  </button>
                  {fe('comprobante') && <div className="mt-[6px] text-[12px] text-[var(--urgent)]">{fe('comprobante')}</div>}
                </div>
              </div>
            )}
          </section>

          {/* Política */}
          <div className="border border-[var(--line)] rounded-[12px] px-4 py-[14px] mb-6">
            <div className="text-[13px] font-bold mb-[6px]">Devoluciones y Cancelaciones</div>
            <div className="text-[13px] text-[var(--ink-2)] leading-[1.6]">
              Una vez procesada la compra NO se puede cancelar la orden. NO hay devoluciones de ningún tipo.
              {tiendaEmail && (
                <> Por favor contactar por correo electrónico a{' '}
                  <a href={`mailto:${tiendaEmail}`} className="text-[var(--ink)] font-semibold underline">{tiendaEmail}</a>.
                </>
              )}
            </div>
          </div>

          {serverError && (
            <div className="text-[13px] text-[var(--urgent)] mb-4 px-[14px] py-[10px] bg-[#fef2f2] rounded-lg border border-[#fecaca]">
              {serverError}
            </div>
          )}

          <button className="btn btn-primary btn-block h-[56px] text-[16px] font-semibold rounded-[14px]"
            onClick={confirmar} disabled={loading || uploading}>
            {loading ? 'Procesando...' : `Finalizar compra · ${formatCurrencyTienda(total, simbolo)}`}
          </button>
        </div>

        {/* COLUMNA DERECHA — resumen */}
        <div className="buyer-cart-summary sticky top-[72px]">
          <div className="border border-[var(--line)] rounded-[16px] overflow-hidden">
            {/* Prendas */}
            <div className="px-5 pt-5">
              {items.map(item => (
                <div key={carritoItemKey(item.prendaId, item.talla)} className="buyer-cart-summary-item grid gap-3 items-center mb-4 grid-cols-[64px_1fr_auto]">
                  <div className="relative">
                    <div className="w-[64px] h-[80px] rounded-[10px] overflow-hidden bg-[var(--surface-2)]">
                      {item.foto
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={item.foto} alt={item.nombre} className="w-full h-full object-cover" />
                        : <div className="w-full h-full bg-[#eee]" />}
                    </div>
                    <div className="absolute top-[-6px] right-[-6px] w-5 h-5 rounded-full bg-[#555] text-white text-[11px] font-bold flex items-center justify-center">1</div>
                  </div>
                  <div>
                    {item.marca && <div className="text-[11px] text-[var(--ink-3)] font-semibold uppercase tracking-[0.06em]">{item.marca}</div>}
                    <div className="text-[13px] font-semibold">{item.nombre}</div>
                    {item.talla && <div className="text-[12px] text-[var(--ink-3)]">Talla {item.talla}</div>}
                  </div>
                  <div className="mono tnum text-[14px] font-semibold">{formatCurrencyTienda(item.precio, simbolo)}</div>
                </div>
              ))}
            </div>

            <hr className="border-none border-t border-[var(--line)] my-1" />

            {/* Totales */}
            <div className="px-5 py-4">
              <div className="flex justify-between text-[13px] text-[var(--ink-2)] mb-2">
                <span>Subtotal · {items.length} {items.length === 1 ? 'prenda' : 'prendas'}</span>
                <span className="mono tnum">{formatCurrencyTienda(totalPrendas, simbolo)}</span>
              </div>
              <div className="flex justify-between text-[13px] text-[var(--ink-2)] mb-3">
                <span>Envío</span>
                <span className="mono tnum">{envioResumen}</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-[16px] font-bold">Total</span>
                <div className="text-right">
                  <span className="text-[11px] text-[var(--ink-3)] mr-1">{tiendaConfig.moneda}</span>
                  <span className="mono tnum text-[22px] font-extrabold">{formatCurrencyTienda(total, simbolo)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
