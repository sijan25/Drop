'use client';

import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { toast } from 'sonner';
import type { BuyerProfile } from '@/components/buyer/buyer-auth-modal';
import type { BoxfulChangeData } from '@/components/checkout/checkout-panels';
import type { Prenda } from '@/types/prenda';
import type { Tienda } from '@/types/tienda';
import type { MetodoPago, MetodoEnvio } from '@/types/envio';
import { obtenerPerfilComprador } from '@/lib/buyer/actions';
import { crearCheckoutPublico } from '@/lib/checkout/actions';
import { uploadImage } from '@/lib/cloudinary/client';
import { createClient } from '@/lib/supabase/client';
import {
  getAvailableProductSizes,
  getPrimaryProductSize,
  getProductSizeQuantities,
  getProductSizeQuantity,
  getProductSizes,
  getProductTotalQuantity,
} from '@/lib/product-sizes';


export type CheckoutStep = 'none' | 'envio' | 'pago' | 'confirmado';

export function usePrendaCheckout({
  prenda,
  tienda,
  metodosPago,
  metodosEnvio,
  dropId = null,
  channelName,
}: {
  prenda: Prenda;
  tienda: Tienda;
  metodosPago: MetodoPago[];
  metodosEnvio: MetodoEnvio[];
  dropId?: string | null;
  channelName: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fotoIdx, setFotoIdx] = useState(0);
  const [checkoutStep, setCheckoutStep] = useState<CheckoutStep>('none');
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [direccion, setDireccion] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [buyer, setBuyer] = useState<BuyerProfile | null>(null);
  const [metodoEnvioId, setMetodoEnvioId] = useState('boxful');
  const [boxfulData, setBoxfulData] = useState<BoxfulChangeData>({ isBoxful: true, quote: null, destination: null, mode: 'boxful_dropoff' });
  const [metodoPagoId, setMetodoPagoId] = useState(metodosPago[0]?.id ?? '');
  const [uploading, setUploading] = useState(false);
  const [comprobanteUrl, setComprobanteUrl] = useState<string | null>(null);
  const [cardData, setCardData] = useState({ number: '', holder: '', expireMonth: '', expireYear: '', cvv: '', billingAddress: '', billingCity: '', billingState: 'HN-CR', billingPhone: '' });
  const [errorMsg, setErrorMsg] = useState('');
  const [loadingPedido, setLoadingPedido] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  const [pedidoNumero, setPedidoNumero] = useState('');
  const [pedidoTrackingUrl, setPedidoTrackingUrl] = useState('');
  const [tallaSeleccionada, setTallaSeleccionada] = useState(getAvailableProductSizes(prenda)[0] ?? getPrimaryProductSize(prenda) ?? '');
  const [zoomActivo, setZoomActivo] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });
  const [isCompact, setIsCompact] = useState(false);
  const [prendaEstado, setPrendaEstado] = useState(prenda.estado);
  const [prendaCantidad, setPrendaCantidad] = useState(getProductTotalQuantity(prenda));
  const [cantidadesPorTalla, setCantidadesPorTalla] = useState<Record<string, number>>(getProductSizeQuantities(prenda));

  useEffect(() => {
    const update = () => setIsCompact(window.innerWidth <= 900);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(channelName)
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
  }, [prenda.id, channelName]);

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
  const costoEnvio = boxfulData.isBoxful ? (boxfulData.quote?.price ?? 0) : (metodoEnvioSel?.precio ?? 0);
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
    if (tallaSeleccionada && getProductSizeQuantity(prendaRuntime, tallaSeleccionada) > 0) return tallaSeleccionada;
    return tallasDisponibles[0] ?? getPrimaryProductSize(prendaRuntime) ?? '';
  }, [prendaRuntime, tallaSeleccionada, tallasDisponibles, tallasProducto.length]);

  const cantidadTallaSeleccionada = tallasProducto.length > 0
    ? getProductSizeQuantity(prendaRuntime, tallaActiva)
    : prendaCantidad;

  const estaBloqueada = prendaEstado === 'apartada' || (prendaEstado === 'vendida' && prendaCantidad <= 0);
  const tieneStock = !estaBloqueada && (tallasProducto.length > 0 ? cantidadTallaSeleccionada > 0 : prendaCantidad > 0);
  const prendaEstadoVisual = tieneStock ? 'disponible' : prendaEstado;
  const initials = tienda.nombre.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const checkoutOpen = checkoutStep !== 'none';

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
        // usuario canceló o navegador falló, intentar copiar
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
    setZoomPos({ x: Math.min(100, Math.max(0, x)), y: Math.min(100, Math.max(0, y)) });
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
    if (loadingPedido || uploading) return;

    if (!tieneStock) { setErrorMsg('Esta prenda ya no tiene unidades disponibles.'); return; }
    if (tallasProducto.length > 0 && !tallaActiva) { setErrorMsg('Seleccioná una talla disponible.'); return; }
    if (!nombre.trim()) { setErrorMsg('Ingresá tu nombre completo.'); return; }
    if (!whatsapp.trim()) { setErrorMsg('Ingresá tu número de WhatsApp.'); return; }
    if (!direccion.trim()) { setErrorMsg('Ingresá tu dirección.'); return; }
    if (!ciudad.trim()) { setErrorMsg('Ingresá tu ciudad.'); return; }
    if (!metodoEnvioId) { setErrorMsg('Seleccioná un método de envío.'); return; }
    if (boxfulData.isBoxful && (!boxfulData.destination || !boxfulData.quote)) {
      setErrorMsg('Seleccioná departamento y ciudad para calcular el envío con Boxful.');
      return;
    }
    if (!metodoPagoId) { setErrorMsg('Seleccioná un método de pago.'); return; }
    if (metodoPagoSel?.tipo === 'transferencia' && !comprobanteUrl) {
      setErrorMsg('Debés subir el comprobante de transferencia para completar la compra.');
      return;
    }
    const esPixelPay = metodoPagoSel?.tipo === 'tarjeta' && metodoPagoSel?.proveedor?.toLowerCase().includes('pixelpay');
    if (esPixelPay) {
      if (!cardData.number.trim()) { setErrorMsg('Ingresá el número de tarjeta.'); return; }
      if (!cardData.holder.trim()) { setErrorMsg('Ingresá el nombre del titular.'); return; }
      if (!cardData.expireMonth.trim() || !cardData.expireYear.trim()) { setErrorMsg('Ingresá la fecha de vencimiento.'); return; }
      if (!cardData.cvv.trim()) { setErrorMsg('Ingresá el CVV.'); return; }
      if (!cardData.billingPhone.trim()) { setErrorMsg('Ingresá tu teléfono de facturación.'); return; }
    }

    setLoadingPedido(true);
    setProcessingMessage(esPixelPay
      ? 'Estamos enviando el pago a PixelPay. Esto puede tardar unos segundos.'
      : 'Estamos verificando stock y creando tu pedido.'
    );
    setErrorMsg('');

    setProcessingMessage(esPixelPay
      ? 'Procesando tu pago con tarjeta de forma segura.'
      : 'Registrando tu compra y reservando la prenda.'
    );
    const res = await crearCheckoutPublico({
      tiendaId: tienda.id,
      dropId,
      items: [{ prendaId: prenda.id, talla: tallaActiva || null }],
      nombre: nombre.trim(),
      email: email.trim() || null,
      whatsapp: whatsapp.trim(),
      direccion: direccion.trim(),
      ciudad: ciudad.trim(),
      metodoEnvioId: boxfulData.isBoxful ? null : metodoEnvioId,
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
      } : undefined,
      envioBoxful: boxfulData.isBoxful && boxfulData.quote && boxfulData.destination ? {
        mode: boxfulData.mode,
        quote: boxfulData.quote,
        destination: boxfulData.destination,
        originCityName: tienda.ciudad ?? null,
      } : undefined,
    });

    if (res.error || !res.pedido) {
      setErrorMsg(res.error ?? 'Error al crear el pedido. Intentá de nuevo.');
      setLoadingPedido(false);
      setProcessingMessage('');
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
    setProcessingMessage('Compra confirmada. Preparando el resumen del pedido.');
    setCheckoutStep('confirmado');
    setLoadingPedido(false);
    setProcessingMessage('');
  }

  return {
    fileRef,
    fotoIdx, setFotoIdx,
    checkoutStep, setCheckoutStep,
    nombre, setNombre,
    email, setEmail,
    whatsapp, setWhatsapp,
    direccion, setDireccion,
    ciudad, setCiudad,
    buyer,
    metodoEnvioId, setMetodoEnvioId,
    boxfulData, setBoxfulData,
    metodoPagoId, setMetodoPagoId,
    cardData, setCardData,
    uploading,
    comprobanteUrl,
    errorMsg, setErrorMsg,
    loadingPedido,
    processingMessage,
    pedidoNumero,
    pedidoTrackingUrl,
    tallaSeleccionada, setTallaSeleccionada,
    zoomActivo, setZoomActivo,
    zoomPos,
    isCompact,
    prendaEstado: prendaEstadoVisual,
    prendaCantidad,
    cantidadesPorTalla,
    fotos,
    costoEnvio,
    total,
    prendaRuntime,
    tallasProducto,
    tallasDisponibles,
    tallaActiva,
    cantidadTallaSeleccionada,
    tieneStock,
    initials,
    checkoutOpen,
    aplicarBuyer,
    abrirCheckout,
    compartirPrenda,
    actualizarZoom,
    subirComprobante,
    confirmarApartado,
  };
}
