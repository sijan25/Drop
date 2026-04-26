'use server';

import { cookies } from 'next/headers';
import { z } from 'zod';
import { guardServerMutation } from '@/lib/security/request';
import { createBuyerClient, createServiceClient } from '@/lib/supabase/server';
import { CART_SESSION_COOKIE } from '@/lib/supabase/constants';
import {
  getPrimaryProductSize,
  getProductSizes,
  isProductSizeInStock,
  normalizeSelectedProductSize,
} from '@/lib/product-sizes';
import type { Database } from '@/types/database';

export type CartItemDTO = {
  prendaId: string;
  nombre: string;
  marca: string | null;
  talla: string | null;
  precio: number;
  foto: string | null;
  tiendaUsername: string;
  tiendaId: string;
  cantidad: 1;
};

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;
type CartRow = Database['public']['Tables']['carritos']['Row'];
type PrendaRow = Pick<
  Database['public']['Tables']['prendas']['Row'],
  'id' | 'tienda_id' | 'nombre' | 'marca' | 'talla' | 'tallas' | 'cantidades_por_talla' | 'precio' | 'fotos' | 'estado' | 'cantidad'
>;

const SESSION_MAX_AGE = 60 * 60 * 24 * 7;
const MAX_CART_ITEMS = 20;
const uuidSchema = z.uuid();
const addSchema = z.object({
  prendaId: z.uuid(),
  tiendaId: z.uuid(),
  talla: z.string().trim().max(40).nullable().optional(),
});
const removeSchema = z.object({
  prendaId: z.uuid(),
  talla: z.string().trim().max(40).nullable().optional(),
});

function setCartCookie(sessionId: string) {
  return {
    name: CART_SESSION_COOKIE,
    value: sessionId,
    options: {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: SESSION_MAX_AGE,
    },
  };
}

async function getSessionId(create: boolean) {
  const cookieStore = await cookies();
  const current = cookieStore.get(CART_SESSION_COOKIE)?.value;
  if (current && uuidSchema.safeParse(current).success) {
    cookieStore.set(setCartCookie(current));
    return current;
  }

  if (!create) return null;

  const sessionId = crypto.randomUUID();
  cookieStore.set(setCartCookie(sessionId));
  return sessionId;
}

async function getBuyerUserId() {
  const supabase = await createBuyerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

async function findActiveCart(service: ServiceClient, sessionId: string | null, buyerUserId: string | null) {
  let cart: CartRow | null = null;

  if (sessionId) {
    const { data } = await service
      .from('carritos')
      .select('*')
      .eq('session_id', sessionId)
      .eq('estado', 'activo')
      .maybeSingle();
    cart = data;
  }

  if (!cart && buyerUserId) {
    const { data } = await service
      .from('carritos')
      .select('*')
      .eq('buyer_user_id', buyerUserId)
      .eq('estado', 'activo')
      .maybeSingle();
    cart = data;
  }

  if (cart && buyerUserId && cart.buyer_user_id !== buyerUserId) {
    const { data } = await service
      .from('carritos')
      .update({ buyer_user_id: buyerUserId, expires_at: new Date(Date.now() + SESSION_MAX_AGE * 1000).toISOString() })
      .eq('id', cart.id)
      .select('*')
      .single();
    if (data) cart = data;
  }

  return cart;
}

async function loadCartItems(service: ServiceClient, cart: CartRow | null): Promise<CartItemDTO[]> {
  if (!cart) return [];

  const { data: tienda } = await service
    .from('tiendas')
    .select('id, username')
    .eq('id', cart.tienda_id)
    .eq('activa', true)
    .maybeSingle();

  if (!tienda) return [];

  const { data: itemRows } = await service
    .from('carrito_items')
    .select('id, prenda_id, talla_seleccionada, created_at')
    .eq('carrito_id', cart.id)
    .order('created_at', { ascending: true });

  const rows = itemRows ?? [];
  const ids = rows.map(item => item.prenda_id);
  if (ids.length === 0) return [];

  const { data: prendasData } = await service
    .from('prendas')
    .select('id, tienda_id, nombre, marca, talla, tallas, cantidades_por_talla, precio, fotos, estado, cantidad')
    .eq('tienda_id', cart.tienda_id)
    .in('id', ids);

  const prendas = new Map((prendasData ?? []).map(prenda => [prenda.id, prenda as PrendaRow]));
  const staleItemIds: string[] = [];
  const items: CartItemDTO[] = [];

  for (const row of rows) {
    const prenda = prendas.get(row.prenda_id);
    if (!prenda || prenda.estado !== 'disponible' || !isProductSizeInStock(prenda, row.talla_seleccionada)) {
      staleItemIds.push(row.id);
      continue;
    }

    const tallaSeleccionada =
      normalizeSelectedProductSize(prenda, row.talla_seleccionada)
      ?? getPrimaryProductSize(prenda);

    items.push({
      prendaId: prenda.id,
      nombre: prenda.nombre,
      marca: prenda.marca,
      talla: tallaSeleccionada,
      precio: Number(prenda.precio),
      foto: prenda.fotos?.[0] ?? null,
      tiendaUsername: tienda.username,
      tiendaId: tienda.id,
      cantidad: 1,
    });
  }

  if (staleItemIds.length > 0) {
    await service
      .from('carrito_items')
      .delete()
      .eq('carrito_id', cart.id)
      .in('id', staleItemIds);
  }

  return items;
}

export async function obtenerCarrito(): Promise<{ items: CartItemDTO[]; error?: string }> {
  const guardError = await guardServerMutation('cart:get', 120, 10 * 60);
  if (guardError) return { items: [], error: guardError };

  const service = await createServiceClient();
  const sessionId = await getSessionId(false);
  const buyerUserId = await getBuyerUserId();

  if (!sessionId && !buyerUserId) return { items: [] };

  const cart = await findActiveCart(service, sessionId, buyerUserId);
  return { items: await loadCartItems(service, cart) };
}

export async function agregarItemCarrito(input: z.input<typeof addSchema>): Promise<{ items: CartItemDTO[]; error?: string }> {
  const guardError = await guardServerMutation('cart:add', 80, 10 * 60);
  if (guardError) return { items: [], error: guardError };

  const parsed = addSchema.safeParse(input);
  if (!parsed.success) return { items: [], error: 'No pudimos agregar esa prenda al carrito.' };

  const service = await createServiceClient();
  const sessionId = await getSessionId(true);
  const buyerUserId = await getBuyerUserId();

  const { data: prenda } = await service
    .from('prendas')
    .select('id, tienda_id, nombre, marca, talla, tallas, cantidades_por_talla, precio, fotos, estado, cantidad')
    .eq('id', parsed.data.prendaId)
    .eq('tienda_id', parsed.data.tiendaId)
    .maybeSingle();

  if (!prenda || prenda.estado !== 'disponible') {
    return { items: [], error: 'Esa prenda ya no está disponible.' };
  }

  const tallasDisponibles = getProductSizes(prenda);
  const tallaSeleccionada = normalizeSelectedProductSize(prenda, parsed.data.talla);
  if (tallasDisponibles.length > 0 && !tallaSeleccionada) {
    return { items: [], error: 'Seleccioná una talla disponible.' };
  }
  if (!isProductSizeInStock(prenda, tallaSeleccionada)) {
    return { items: [], error: 'Esa talla ya no está disponible.' };
  }

  const { data: tienda } = await service
    .from('tiendas')
    .select('id')
    .eq('id', parsed.data.tiendaId)
    .eq('activa', true)
    .maybeSingle();

  if (!tienda) return { items: [], error: 'La tienda no está disponible.' };

  let cart = await findActiveCart(service, sessionId, buyerUserId);
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000).toISOString();

  if (!cart) {
    const { data, error } = await service
      .from('carritos')
      .insert({
        session_id: sessionId,
        buyer_user_id: buyerUserId,
        tienda_id: parsed.data.tiendaId,
        expires_at: expiresAt,
      })
      .select('*')
      .single();

    if (error || !data) return { items: [], error: 'No pudimos preparar tu carrito.' };
    cart = data;
  } else if (cart.tienda_id !== parsed.data.tiendaId) {
    await service.from('carrito_items').delete().eq('carrito_id', cart.id);
    const { data, error } = await service
      .from('carritos')
      .update({
        tienda_id: parsed.data.tiendaId,
        session_id: sessionId,
        buyer_user_id: buyerUserId,
        expires_at: expiresAt,
      })
      .eq('id', cart.id)
      .select('*')
      .single();

    if (error || !data) return { items: [], error: 'No pudimos cambiar el carrito de tienda.' };
    cart = data;
  } else {
    await service
      .from('carritos')
      .update({ session_id: sessionId, buyer_user_id: buyerUserId, expires_at: expiresAt })
      .eq('id', cart.id);
  }

  const { count } = await service
    .from('carrito_items')
    .select('id', { count: 'exact', head: true })
    .eq('carrito_id', cart.id);

  const { data: existing } = await service
    .from('carrito_items')
    .select('id')
    .eq('carrito_id', cart.id)
    .eq('prenda_id', parsed.data.prendaId)
    .maybeSingle();

  if (!existing && (count ?? 0) >= MAX_CART_ITEMS) {
    return { items: await loadCartItems(service, cart), error: 'El carrito llegó al máximo de prendas.' };
  }

  if (!existing) {
    const { error } = await service
      .from('carrito_items')
      .insert({
        carrito_id: cart.id,
        prenda_id: parsed.data.prendaId,
        talla_seleccionada: tallaSeleccionada,
        cantidad: 1,
      });

    if (error) return { items: await loadCartItems(service, cart), error: 'No pudimos agregar esa prenda al carrito.' };
  } else {
    await service
      .from('carrito_items')
      .update({ talla_seleccionada: tallaSeleccionada })
      .eq('id', existing.id);
  }

  return { items: await loadCartItems(service, cart) };
}

export async function quitarItemCarrito(input: z.input<typeof removeSchema>): Promise<{ items: CartItemDTO[]; error?: string }> {
  const guardError = await guardServerMutation('cart:remove', 100, 10 * 60);
  if (guardError) return { items: [], error: guardError };

  const parsed = removeSchema.safeParse(input);
  if (!parsed.success) return { items: [], error: 'No pudimos quitar esa prenda.' };

  const service = await createServiceClient();
  const cart = await findActiveCart(service, await getSessionId(false), await getBuyerUserId());
  if (!cart) return { items: [] };

  let removeQuery = service
    .from('carrito_items')
    .delete()
    .eq('carrito_id', cart.id)
    .eq('prenda_id', parsed.data.prendaId);

  removeQuery = parsed.data.talla
    ? removeQuery.eq('talla_seleccionada', parsed.data.talla)
    : removeQuery.is('talla_seleccionada', null);

  await removeQuery;

  return { items: await loadCartItems(service, cart) };
}

export async function limpiarCarrito(): Promise<{ items: CartItemDTO[]; error?: string }> {
  const guardError = await guardServerMutation('cart:clear', 60, 10 * 60);
  if (guardError) return { items: [], error: guardError };

  const service = await createServiceClient();
  const cart = await findActiveCart(service, await getSessionId(false), await getBuyerUserId());
  if (!cart) return { items: [] };

  await service.from('carrito_items').delete().eq('carrito_id', cart.id);
  await service.from('carritos').update({ estado: 'abandonado' }).eq('id', cart.id);

  return { items: [] };
}
