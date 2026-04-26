'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { notificarPedidoCreado } from '@/lib/resend/emails'
import { wsNuevoPedido } from '@/lib/whatsapp/notifications';
import { getProductSizes, isProductSizeInStock, normalizeSelectedProductSize } from '@/lib/product-sizes';
import { buildOrderTrackingUrl } from '@/lib/security/order-access';
import { guardServerMutation } from '@/lib/security/request';
import { createBuyerClient, createServiceClient, getServiceRoleConfigError } from '@/lib/supabase/server';
import type { Database } from '@/types/database';

type MetodoPago = Database['public']['Tables']['metodos_pago']['Row'];

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
  direccion: z.string().trim().min(4).max(240),
  ciudad: z.string().trim().min(2).max(90),
  metodoEnvioId: z.uuid(),
  metodoPagoId: z.uuid(),
  comprobanteUrl: z.string().trim().url().max(600).nullable().optional(),
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

function publicUrlIsAllowed(url: string | null | undefined) {
  if (!url) return true;

  try {
    const parsed = new URL(url);
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (supabaseUrl && parsed.origin === new URL(supabaseUrl).origin) return true;

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME ?? process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    if (cloudName && parsed.origin === 'https://res.cloudinary.com') {
      return parsed.pathname.startsWith(`/${cloudName}/fardodrops/comprobantes/`);
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
  const costo = precio === 0 ? 'Gratis' : `L ${precio}`;
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

export async function crearCheckoutPublico(input: CheckoutInput): Promise<{
  error?: string;
  pedido?: { id: string; numero: string; trackingUrl: string };
}> {
  const guardError = await guardServerMutation('checkout:create', 8, 10 * 60);
  if (guardError) return { error: guardError };

  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) {
    return { error: 'Revisá los datos del checkout e intentá de nuevo.' };
  }

  const data = parsed.data;
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
    .select('id, talla, tallas, cantidad, cantidades_por_talla')
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
      p_metodo_envio_id: data.metodoEnvioId,
      p_metodo_pago_id: data.metodoPagoId,
      p_comprobante_url: data.comprobanteUrl ?? null,
    }
  );

  if (checkoutError) {
    console.error('[checkout] Error creando checkout público:', checkoutError);
    return { error: mensajeRpc(checkoutError) };
  }

  const checkout = checkoutRows?.[0];
  if (!checkout) return { error: 'No pudimos crear el pedido. Intentá de nuevo.' };

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
        tiendaNombre: checkout.tienda_nombre,
        tiendaUsername: checkout.tienda_username,
        tiendaEmail,
        metodoPago: metodoPagoLabelDesdeRpc(checkout),
        metodoEnvio: metodoEnvioLabelDesdeRpc(checkout),
        direccion: direccionCompleta,
        comprobanteUrl: data.comprobanteUrl ?? null,
      });
    }
    const tiendaWa = await service.from('tiendas').select('whatsapp').eq('id', data.tiendaId).maybeSingle()
    wsNuevoPedido({
      tiendaWhatsApp: tiendaWa.data?.whatsapp,
      tiendaNombre: checkout.tienda_nombre,
      numeroPedido: checkout.numero,
      compradorNombre: data.nombre,
      compradorTelefono: data.whatsapp,
      prendaNombre: checkout.prendas_count > 1 ? `${checkout.prendas_count} prendas` : checkout.prenda_nombre,
      montoTotal: Number(checkout.monto_total),
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
      await service.from('actividad').insert({
        drop_id: data.dropId,
        tipo: 'compra',
        texto: `${nombreCorto} · ${producto}${talla}`,
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
