'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { notificarPedidoCreado } from '@/lib/resend/emails'
import { wsNuevoPedido } from '@/lib/whatsapp/notifications';
import { getProductSizes, isProductSizeInStock, normalizeSelectedProductSize } from '@/lib/product-sizes';
import { buildOrderTrackingUrl } from '@/lib/security/order-access';
import { guardServerMutation } from '@/lib/security/request';
import { createBuyerClient, createServiceClient, getServiceRoleConfigError } from '@/lib/supabase/server';
import { formatCurrencyFree } from '@/lib/config/platform';
import { quoteBoxful } from '@/lib/boxful/client';
import { procesarVentaPixelPay } from '@/lib/pixelpay/client';
import { restaurarInventarioPedido } from '@/lib/orders/restore-stock';
import type { BoxfulQuote, BoxfulShippingMode } from '@/lib/boxful/types';
import type { Json } from '@/types/database';
import type { MetodoPago } from '@/types/envio';

const boxfulQuoteSchema = z.object({
  provider: z.literal('boxful'),
  mode: z.enum(['boxful_dropoff', 'boxful_recoleccion']),
  courierId: z.string().nullable(),
  courierName: z.string().trim().min(1).max(120),
  courierLogo: z.string().trim().url().nullable(),
  price: z.number().min(0).max(10000),
  estimatedDelivery: z.string().trim().min(1).max(80),
  deliveryType: z.string().trim().max(80).nullable(),
  source: z.enum(['boxful', 'local_estimate']),
  note: z.string().trim().max(240).nullable(),
});

const pixelPayCardSchema = z.object({
  number: z.string().trim().min(15).max(19),
  holder: z.string().trim().min(3).max(120),
  expireMonth: z.string().trim().min(1).max(2),
  expireYear: z.string().trim().min(2).max(4),
  cvv: z.string().trim().min(3).max(4),
  billingAddress: z.string().trim().max(200).default(''),
  billingCity: z.string().trim().max(80).default(''),
  billingState: z.string().trim().max(20).default('HN-CR'),
  billingPhone: z.string().trim().min(7).max(20),
});

const checkoutSchema = z.object({
  tiendaId: z.uuid(),
  dropId: z.uuid().nullable().optional(),
  items: z.array(z.object({
    prendaId: z.uuid(),
    talla: z.string().trim().max(40).nullable().optional(),
  })).min(1).max(20),
  nombre: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(180).nullable().optional().or(z.literal('')),
  whatsapp: z.string().trim().min(7).max(40),
  direccion: z.string().trim().min(2).max(240),
  ciudad: z.string().trim().min(2).max(90),
  metodoEnvioId: z.uuid().nullable().optional(),
  metodoPagoId: z.uuid(),
  comprobanteUrl: z.string().trim().url().max(600).nullable().optional(),
  pixelPayCard: pixelPayCardSchema.nullable().optional(),
  envioBoxful: z.object({
    mode: z.enum(['boxful_dropoff', 'boxful_recoleccion']),
    quote: boxfulQuoteSchema,
    destination: z.object({
      stateId: z.string().trim().min(1).max(80),
      stateName: z.string().trim().min(2).max(90),
      cityId: z.string().trim().min(1).max(80),
      cityName: z.string().trim().min(2).max(90),
    }),
    originCityName: z.string().trim().max(90).nullable().optional(),
  }).optional(),
});

type CheckoutInput = z.input<typeof checkoutSchema>;

type CheckoutRpcRow = {
  pedido_id: string;
  numero: string;
  monto_total: number | string;
  tienda_username: string;
  tienda_nombre: string;
  tienda_user_id: string;
  tienda_contact_email: string | null;
  metodo_pago_tipo: MetodoPago['tipo'];
  metodo_pago_nombre: string;
  metodo_envio_nombre: string;
  metodo_envio_precio: number | string;
  prenda_nombre: string;
  prenda_marca: string | null;
  prenda_talla: string | null;
  prendas_count: number;
};

type CheckoutRpcClient = {
  rpc: (
    fn: 'crear_checkout_publico_seguro',
    args: Record<string, unknown>
  ) => Promise<{ data: CheckoutRpcRow[] | null; error: { message: string; code?: string } | null }>;
};

function boxfulModeLabel(mode: BoxfulShippingMode) {
  return mode === 'boxful_dropoff' ? 'Boxful · Punto autorizado' : 'Boxful · Recolección';
}

function publicUrlIsAllowed(url: string | null | undefined) {
  if (!url) return true;

  try {
    const parsed = new URL(url);
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (supabaseUrl && parsed.origin === new URL(supabaseUrl).origin) return true;

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME ?? process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    if (cloudName && parsed.origin === 'https://res.cloudinary.com') {
      return parsed.pathname.startsWith(`/${cloudName}/`) && parsed.pathname.includes('/fardodrops/comprobantes/');
    }

    return false;
  } catch {
    return false;
  }
}

function metodoPagoLabelDesdeRpc(row: CheckoutRpcRow) {
  if (row.metodo_pago_tipo === 'transferencia') return `Transferencia bancaria · ${row.metodo_pago_nombre}`;
  return row.metodo_pago_nombre;
}

function metodoEnvioLabelDesdeRpc(row: CheckoutRpcRow) {
  const precio = Number(row.metodo_envio_precio ?? 0);
  const costo = formatCurrencyFree(precio);
  return `${row.metodo_envio_nombre} · ${costo}`;
}

function mensajeRpc(error: { message: string; code?: string }) {
  if (error.message.includes('permission denied')) {
    return 'No pudimos procesar la compra por permisos internos. Avisale a la tienda para revisarlo.';
  }

  if (error.message.includes('duplicate key')) {
    return 'No pudimos crear el pedido. Intentá de nuevo.';
  }

  return error.message || 'No pudimos procesar la compra. Intentá de nuevo.';
}

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function sanitizePixelPayCard(card: z.infer<typeof pixelPayCardSchema>) {
  const digits = card.number.replace(/\D/g, '');
  return {
    card_last4: digits.slice(-4),
    cardholder_present: Boolean(card.holder),
    billing_country: 'HN',
    billing_state: card.billingState || 'HN-CR',
  };
}

async function registrarIntentoPixelPay(
  service: Awaited<ReturnType<typeof createServiceClient>>,
  payload: {
    pedidoId: string;
    tiendaId: string;
    orderId: string;
    amount: number;
    sandbox: boolean;
    requestPayload: Json;
  },
) {
  const idempotencyKey = `pixelpay:${payload.pedidoId}`;
  const { data, error } = await service
    .from('payment_attempts')
    .upsert({
      pedido_id: payload.pedidoId,
      tienda_id: payload.tiendaId,
      provider: 'pixelpay',
      status: 'processing',
      idempotency_key: idempotencyKey,
      order_id: payload.orderId,
      amount: payload.amount,
      currency: 'HNL',
      sandbox: payload.sandbox,
      request_payload: payload.requestPayload,
      response_payload: {},
      error_message: null,
    }, { onConflict: 'idempotency_key' })
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[checkout] Error registrando intento PixelPay:', error);
    return null;
  }

  return (data as { id?: string } | null)?.id ?? null;
}

async function actualizarIntentoPixelPay(
  service: Awaited<ReturnType<typeof createServiceClient>>,
  attemptId: string | null,
  payload: {
    status: 'approved' | 'failed' | 'sync_pending' | 'synced';
    paymentUuid?: string | null;
    transactionId?: string | null;
    responsePayload?: Json | null;
    errorMessage?: string | null;
  },
) {
  if (!attemptId) return;

  const { error } = await service.from('payment_attempts').update({
    status: payload.status,
    payment_uuid: payload.paymentUuid,
    transaction_id: payload.transactionId,
    response_payload: payload.responsePayload ?? {},
    error_message: payload.errorMessage ?? null,
  }).eq('id', attemptId);

  if (error) console.error('[checkout] Error actualizando intento PixelPay:', error);
}

async function marcarPedidoPixelPayPagado(
  service: Awaited<ReturnType<typeof createServiceClient>>,
  pedidoId: string,
  payload: {
    paymentUuid: string | null;
    paymentHash: string | null;
    orderId: string | null;
    transactionId: string | null;
    response: Json | null;
  },
) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { error } = await service.from('pedidos').update({
      estado: 'pagado',
      comprobante_estado: 'verificado',
      pagado_at: new Date().toISOString(),
      pixelpay_payment_uuid: payload.paymentUuid,
      pixelpay_payment_hash: payload.paymentHash,
    } as Record<string, unknown>).eq('id', pedidoId);

    if (!error) {
      await service.from('pedidos').update({
        pixelpay_order_id: payload.orderId,
        pixelpay_transaction_id: payload.transactionId,
        pixelpay_response: payload.response ?? {},
      } as Record<string, unknown>).eq('id', pedidoId);
      return true;
    }

    console.error('[checkout] Error marcando pedido PixelPay pagado:', error);
    await wait(250 * (attempt + 1));
  }

  return false;
}

async function cancelarPedidoPixelPayFallido(
  service: Awaited<ReturnType<typeof createServiceClient>>,
  pedidoId: string,
  tiendaId: string,
  reason: string,
) {
  await restaurarInventarioPedido(service, pedidoId, tiendaId);
  await service.from('pedidos').update({
    estado: 'cancelado',
    cancelado_at: new Date().toISOString(),
    comprobante_estado: 'rechazado',
    pixelpay_response: { error: reason, cancelled_after_payment_failure: true },
  } as Record<string, unknown>).eq('id', pedidoId);
}

export async function crearCheckoutPublico(input: CheckoutInput): Promise<{
  error?: string;
  pedido?: { id: string; numero: string; trackingUrl: string };
}> {
  const guardError = await guardServerMutation('checkout:create', 20, 10 * 60);
  if (guardError) return { error: guardError };

  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) {
    return { error: 'Revisá los datos del checkout e intentá de nuevo.' };
  }

  const data = parsed.data;
  if (!data.metodoEnvioId && !data.envioBoxful) {
    return { error: 'Seleccioná un método de envío válido.' };
  }

  if (!publicUrlIsAllowed(data.comprobanteUrl)) {
    return { error: 'El comprobante no pertenece al almacenamiento permitido.' };
  }

  const variantKeys = data.items.map(item => `${item.prendaId}:${(item.talla ?? '').trim().toLowerCase() || '__none__'}`);
  if (new Set(variantKeys).size !== data.items.length) {
    return { error: 'Hay variantes duplicadas en el pedido.' };
  }

  const itemIds = Array.from(new Set(data.items.map(item => item.prendaId)));

  const service = await createServiceClient();
  const { data: prendasParaValidar, error: prendasError } = await service
    .from('prendas')
    .select('id, talla, tallas, cantidad, cantidades_por_talla, precio')
    .eq('tienda_id', data.tiendaId)
    .in('id', itemIds);

  if (prendasError || !prendasParaValidar || prendasParaValidar.length !== itemIds.length) {
    return { error: 'Una de las prendas ya no está disponible.' };
  }

  const prendasPorId = new Map(prendasParaValidar.map(prenda => [prenda.id, prenda]));
  const itemsNormalizados: Array<{ prendaId: string; talla: string | null }> = [];

  for (const item of data.items) {
    const prenda = prendasPorId.get(item.prendaId);
    if (!prenda) return { error: 'Una de las prendas ya no está disponible.' };

    const tallasDisponibles = getProductSizes(prenda);
    const tallaSeleccionada = normalizeSelectedProductSize(prenda, item.talla);
    if (tallasDisponibles.length > 0 && !tallaSeleccionada) {
      return { error: 'Seleccioná una talla disponible para cada prenda.' };
    }
    if (!isProductSizeInStock(prenda, tallaSeleccionada)) {
      return { error: 'La talla seleccionada ya no está disponible.' };
    }

    itemsNormalizados.push({ prendaId: item.prendaId, talla: tallaSeleccionada });
  }

  let boxfulQuote: BoxfulQuote | null = null;
  if (data.envioBoxful) {
    const subtotal = itemsNormalizados.reduce((total, item) => {
      const prenda = prendasPorId.get(item.prendaId);
      return total + Number((prenda as { precio?: number | string } | undefined)?.precio ?? 0);
    }, 0);

    const { data: tiendaBoxful } = await service
      .from('tiendas')
      .select('boxful_email, boxful_password, boxful_enabled')
      .eq('id', data.tiendaId)
      .maybeSingle();
    const boxfulCreds = tiendaBoxful?.boxful_enabled && tiendaBoxful.boxful_email && tiendaBoxful.boxful_password
      ? { email: tiendaBoxful.boxful_email, password: tiendaBoxful.boxful_password }
      : null;

    try {
      boxfulQuote = await quoteBoxful({
        mode: data.envioBoxful.mode,
        originCityName: data.envioBoxful.originCityName,
        destinationStateId: data.envioBoxful.destination.stateId,
        destinationStateName: data.envioBoxful.destination.stateName,
        destinationCityId: data.envioBoxful.destination.cityId,
        destinationCityName: data.envioBoxful.destination.cityName,
        preferredCourierId: data.envioBoxful.quote.courierId,
        itemsCount: itemsNormalizados.length,
        subtotal,
      }, boxfulCreds);
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'No pudimos confirmar la cotización de Boxful.' };
    }
  }

  // ── PixelPay: preparar credenciales, pero cobrar después de crear el pedido local.
  let pixelPaymentUuid: string | null = null;
  let pixelPaymentHash: string | null = null;
  let pixelOrderId: string | null = null;
  let pixelTransactionId: string | null = null;
  let pixelResponse: Json | null = null;
  let pixelAttemptId: string | null = null;
  let pixelPayCredentials: {
    sandbox: boolean;
    endpoint?: string | null;
    keyId?: string | null;
    secretKey?: string | null;
  } | null = null;

  const { data: metodoPagoDb } = await service
    .from('metodos_pago')
    .select('tipo, proveedor')
    .eq('id', data.metodoPagoId)
    .maybeSingle();

  const isPixelPayCheckout = metodoPagoDb?.tipo === 'tarjeta' && metodoPagoDb?.proveedor?.toLowerCase().includes('pixelpay');

  if (isPixelPayCheckout) {
    if (!data.pixelPayCard) {
      return { error: 'Ingresá los datos de tu tarjeta para continuar.' };
    }

    const { data: tiendaCredenciales } = await service
      .from('tiendas')
      .select('pixelpay_endpoint, pixelpay_key_id, pixelpay_secret_key, pixelpay_sandbox')
      .eq('id', data.tiendaId)
      .maybeSingle();

    const isSandbox = (tiendaCredenciales as { pixelpay_sandbox?: boolean } | null)?.pixelpay_sandbox ?? true;
    pixelPayCredentials = {
      sandbox: isSandbox,
      endpoint: (tiendaCredenciales as { pixelpay_endpoint?: string } | null)?.pixelpay_endpoint,
      keyId: (tiendaCredenciales as { pixelpay_key_id?: string } | null)?.pixelpay_key_id,
      secretKey: (tiendaCredenciales as { pixelpay_secret_key?: string } | null)?.pixelpay_secret_key,
    };
  }

  const buyer = await createBuyerClient();
  const { data: buyerAuth } = await buyer.auth.getUser();
  const compradorEmail = data.email || buyerAuth.user?.email || null;
  const direccionCompleta = `${data.direccion}, ${data.ciudad}`;
  if (buyerAuth.user) {
    const { data: ownerStore } = await buyer
      .from('tiendas')
      .select('id')
      .eq('user_id', buyerAuth.user.id)
      .limit(1)
      .maybeSingle();

    if (ownerStore) {
      await buyer.auth.signOut();
      return { error: 'Tu cuenta de tienda no puede usarse como comprador. Iniciá sesión con otro correo o comprá como invitado.' };
    }
  }

  const rpcClient = buyer as unknown as CheckoutRpcClient;
  const { data: checkoutRows, error: checkoutError } = await rpcClient.rpc(
    'crear_checkout_publico_seguro',
    {
      p_tienda_id: data.tiendaId,
      p_drop_id: data.dropId ?? null,
      p_items: itemsNormalizados,
      p_comprador_nombre: data.nombre,
      p_comprador_email: compradorEmail,
      p_comprador_telefono: data.whatsapp,
      p_direccion: data.direccion,
      p_ciudad: data.ciudad,
      p_metodo_envio_id: data.envioBoxful ? null : data.metodoEnvioId,
      p_metodo_pago_id: data.metodoPagoId,
      p_comprobante_url: data.comprobanteUrl ?? null,
      p_envio_proveedor: data.envioBoxful ? 'boxful' : null,
      p_envio_modalidad: data.envioBoxful?.mode ?? null,
      p_envio_monto: boxfulQuote?.price ?? null,
      p_envio_courier_id: boxfulQuote?.courierId ?? null,
      p_envio_courier_nombre: boxfulQuote?.courierName ?? null,
      p_envio_courier_logo: boxfulQuote?.courierLogo ?? null,
      p_envio_metadata: data.envioBoxful ? {
        destination: data.envioBoxful.destination,
        originCityName: data.envioBoxful.originCityName ?? null,
        quote: boxfulQuote,
      } : null,
    }
  );

  if (checkoutError) {
    console.error('[checkout] Error creando checkout público:', checkoutError);
    return { error: mensajeRpc(checkoutError) };
  }

  const checkout = checkoutRows?.[0];
  if (!checkout) return { error: 'No pudimos crear el pedido. Intentá de nuevo.' };

  if (isPixelPayCheckout && data.pixelPayCard && pixelPayCredentials) {
    pixelOrderId = checkout.numero;

    await service.from('pedidos').update({
      estado: 'procesando_pago',
      pixelpay_order_id: pixelOrderId,
      pixelpay_response: { status: 'payment_started', provider: 'pixelpay' },
    } as Record<string, unknown>).eq('id', checkout.pedido_id);

    const orderAmount = Number(checkout.monto_total);
    pixelAttemptId = await registrarIntentoPixelPay(service, {
      pedidoId: checkout.pedido_id,
      tiendaId: data.tiendaId,
      orderId: pixelOrderId,
      amount: orderAmount,
      sandbox: pixelPayCredentials.sandbox,
      requestPayload: {
        order_id: pixelOrderId,
        amount: orderAmount,
        currency: 'HNL',
        customer_email_present: Boolean(data.email),
        item_count: itemsNormalizados.length,
        card: sanitizePixelPayCard(data.pixelPayCard),
      },
    });

    const payResult = await procesarVentaPixelPay(
      pixelPayCredentials,
      {
        number: data.pixelPayCard.number,
        holder: data.pixelPayCard.holder,
        expireMonth: data.pixelPayCard.expireMonth,
        expireYear: data.pixelPayCard.expireYear,
        cvv: data.pixelPayCard.cvv,
        billingAddress: data.pixelPayCard.billingAddress || data.direccion || 'N/A',
        billingCity: data.pixelPayCard.billingCity || data.ciudad || 'N/A',
        billingState: data.pixelPayCard.billingState || 'HN-CR',
        billingPhone: data.pixelPayCard.billingPhone,
      },
      {
        id: pixelOrderId,
        amount: orderAmount,
        currency: 'HNL',
        customerName: data.nombre,
        customerEmail: data.email || 'checkout@droppi.app',
        items: itemsNormalizados.map(item => {
          const p = prendasPorId.get(item.prendaId);
          return {
            code: item.prendaId.slice(0, 8),
            title: (p as { nombre?: string } | undefined)?.nombre ?? 'Prenda',
            price: Number((p as { precio?: number } | undefined)?.precio ?? 0),
            qty: 1,
          };
        }),
      }
    );

    if (!payResult.success) {
      await actualizarIntentoPixelPay(service, pixelAttemptId, {
        status: 'failed',
        responsePayload: payResult.metadata as Json | undefined,
        errorMessage: payResult.message,
      });
      await cancelarPedidoPixelPayFallido(service, checkout.pedido_id, data.tiendaId, payResult.message);
      return { error: payResult.message };
    }

    pixelPaymentUuid = payResult.payment_uuid;
    pixelPaymentHash = payResult.payment_hash;
    pixelTransactionId = payResult.transaction_id;
    pixelResponse = payResult.metadata as Json;

    await actualizarIntentoPixelPay(service, pixelAttemptId, {
      status: 'approved',
      paymentUuid: pixelPaymentUuid,
      transactionId: pixelTransactionId,
      responsePayload: pixelResponse,
    });

    const markedPaid = await marcarPedidoPixelPayPagado(service, checkout.pedido_id, {
      paymentUuid: pixelPaymentUuid,
      paymentHash: pixelPaymentHash,
      orderId: pixelOrderId,
      transactionId: pixelTransactionId,
      response: pixelResponse,
    });

    if (!markedPaid) {
      await actualizarIntentoPixelPay(service, pixelAttemptId, {
        status: 'sync_pending',
        paymentUuid: pixelPaymentUuid,
        transactionId: pixelTransactionId,
        responsePayload: pixelResponse,
        errorMessage: 'Pago aprobado en PixelPay, pendiente de sincronizar pedido local.',
      });

      return {
        error: 'El pago fue aprobado, pero estamos confirmando el pedido. Revisá el estado del pedido en unos segundos.',
        pedido: {
          id: checkout.pedido_id,
          numero: checkout.numero,
          trackingUrl: buildOrderTrackingUrl({ id: checkout.pedido_id, numero: checkout.numero }),
        },
      };
    }

    await actualizarIntentoPixelPay(service, pixelAttemptId, {
      status: 'synced',
      paymentUuid: pixelPaymentUuid,
      transactionId: pixelTransactionId,
      responsePayload: pixelResponse,
    });
  }

  if (buyerAuth.user) {
    await buyer.from('compradores').upsert({
      user_id: buyerAuth.user.id,
      nombre: data.nombre,
      email: compradorEmail,
      telefono: data.whatsapp,
      direccion: data.direccion,
      ciudad: data.ciudad,
    }, { onConflict: 'user_id' });
  }

  try {
    let tiendaEmail = checkout.tienda_contact_email || '';
    if (!tiendaEmail && !getServiceRoleConfigError()) {
      const { data: owner } = await service.auth.admin.getUserById(checkout.tienda_user_id);
      tiendaEmail = owner.user?.email || '';
    }

    const prendaTalla = itemsNormalizados.length === 1
      ? (itemsNormalizados[0].talla ?? checkout.prenda_talla)
      : null;

    if (tiendaEmail || compradorEmail) {
      await notificarPedidoCreado({
        compradorEmail,
        compradorNombre: data.nombre,
        compradorTelefono: data.whatsapp,
        pedidoId: checkout.pedido_id,
        numeroPedido: checkout.numero,
        prendaNombre: checkout.prendas_count > 1 ? `${checkout.prendas_count} prendas` : checkout.prenda_nombre,
        prendaMarca: checkout.prendas_count > 1 ? null : checkout.prenda_marca,
        prendaTalla,
        montoTotal: Number(checkout.monto_total),
        simboloMoneda: tiendaSimb,
        tiendaNombre: checkout.tienda_nombre,
        tiendaUsername: checkout.tienda_username,
        tiendaEmail,
        metodoPago: metodoPagoLabelDesdeRpc(checkout),
        metodoEnvio: data.envioBoxful && boxfulQuote
          ? `${boxfulModeLabel(data.envioBoxful.mode)} · ${formatCurrencyFree(boxfulQuote.price)}`
          : metodoEnvioLabelDesdeRpc(checkout),
        direccion: direccionCompleta,
        comprobanteUrl: data.comprobanteUrl ?? null,
        pagoConfirmado: !!pixelPaymentUuid,
      });
    }
    const tiendaWa = await service.from('tiendas').select('whatsapp, simbolo_moneda').eq('id', data.tiendaId).maybeSingle()
    const tiendaSimb = (tiendaWa.data as { simbolo_moneda?: string } | null)?.simbolo_moneda ?? 'L'
    wsNuevoPedido({
      tiendaWhatsApp: tiendaWa.data?.whatsapp,
      tiendaNombre: checkout.tienda_nombre,
      numeroPedido: checkout.numero,
      compradorNombre: data.nombre,
      compradorTelefono: data.whatsapp,
      prendaNombre: checkout.prendas_count > 1 ? `${checkout.prendas_count} prendas` : checkout.prenda_nombre,
      montoTotal: Number(checkout.monto_total),
      simboloMoneda: tiendaSimb,
      metodoPago: metodoPagoLabelDesdeRpc(checkout),
    }).catch(() => {});
  } catch (error) {
    console.error('[checkout] Error enviando notificación:', error);
  }

  // Registrar actividad en vivo si el checkout fue de un drop
  if (data.dropId) {
    try {
      const nombreCorto = data.nombre.trim().split(' ').slice(0, 2).map((p, i) =>
        i === 1 ? p.charAt(0).toUpperCase() + '.' : p
      ).join(' ');
      const talla = itemsNormalizados.length === 1 && itemsNormalizados[0].talla
        ? ` · ${itemsNormalizados[0].talla}`
        : '';
      const producto = checkout.prendas_count > 1
        ? `${checkout.prendas_count} prendas`
        : [checkout.prenda_nombre, checkout.prenda_marca].filter(Boolean).join(' ');
      const texto = `${nombreCorto} · ${producto}${talla}`;
      const { data: actividadExistente } = await service
        .from('actividad')
        .select('id')
        .eq('drop_id', data.dropId)
        .eq('tipo', 'compra')
        .eq('texto', texto)
        .gt('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
        .limit(1)
        .maybeSingle();

      if (!actividadExistente) await service.from('actividad').insert({
        drop_id: data.dropId,
        tipo: 'compra',
        texto,
      });
    } catch {
      // no-op: activity is non-critical
    }
  }

  revalidatePath(`/${checkout.tienda_username}`);
  revalidatePath('/pedidos');
  revalidatePath('/comprobantes');

  return {
    pedido: {
      id: checkout.pedido_id,
      numero: checkout.numero,
      trackingUrl: buildOrderTrackingUrl({ id: checkout.pedido_id, numero: checkout.numero }),
    },
  };
}
