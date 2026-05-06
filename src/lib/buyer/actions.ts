'use server';

import { z } from 'zod';
import { guardServerMutation } from '@/lib/security/request';
import { createBuyerClient } from '@/lib/supabase/server';
import { APP_URL } from '@/lib/config/platform';
import type { Pedido } from '@/types/pedido';

const PHONE_RE = /^[+\d][\d\s().-]{6,39}$/;
const OWNER_BUYER_ERROR = 'Ese correo pertenece a una tienda. Usá otro correo para comprar o iniciá sesión como tienda.';

export type CompradorPerfil = {
  nombre: string;
  email: string;
  telefono: string | null;
  direccion: string | null;
  ciudad: string | null;
};

export type CompradorSesionResultado = {
  error?: string;
  notice?: string;
  blockedOwner?: boolean;
  comprador?: CompradorPerfil;
};

export type CompradorPedidoResumen = Pick<
  Pedido,
  'id' | 'numero' | 'estado' | 'monto_total' | 'created_at' | 'metodo_envio' | 'apartado_expira_at'
> & {
  drop: { nombre: string | null } | null;
  items: {
    id: string;
    precio: number;
    talla_seleccionada: string | null;
    prenda: { nombre: string | null; talla: string | null; marca: string | null; fotos: string[] | null } | null;
  }[];
};

type CompradorPerfilRow = {
  nombre: string | null;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  ciudad: string | null;
};

const optionalText = (max: number) =>
  z.string().trim().max(max).nullable().optional().or(z.literal('')).transform(value => value || null);

const perfilSchema = z.object({
  nombre: z.string().trim().min(2).max(120),
  telefono: z.string().trim().max(40).nullable().optional().or(z.literal('')).transform(value => value || null),
  direccion: optionalText(240),
  ciudad: optionalText(90),
}).superRefine((data, ctx) => {
  if (data.telefono && !PHONE_RE.test(data.telefono)) {
    ctx.addIssue({
      code: 'custom',
      path: ['telefono'],
      message: 'Ingresá un WhatsApp válido.',
    });
  }

  if (data.direccion && data.direccion.length < 4) {
    ctx.addIssue({
      code: 'custom',
      path: ['direccion'],
      message: 'La dirección debe tener al menos 4 caracteres.',
    });
  }

  if (data.ciudad && data.ciudad.length < 2) {
    ctx.addIssue({
      code: 'custom',
      path: ['ciudad'],
      message: 'La ciudad debe tener al menos 2 caracteres.',
    });
  }
});

type PerfilInput = z.input<typeof perfilSchema>;
type BuyerServerClient = Awaited<ReturnType<typeof createBuyerClient>>;

const authSchema = z.object({
  email: z.string().trim().email().max(180).transform(value => value.toLowerCase()),
  password: z.string().min(8).max(200),
});

const registerSchema = authSchema.extend({
  nombre: z.string().trim().min(2).max(120),
  telefono: z.string().trim().max(40).nullable().optional().or(z.literal('')).transform(value => value || null),
}).superRefine((data, ctx) => {
  if (data.telefono && !PHONE_RE.test(data.telefono)) {
    ctx.addIssue({
      code: 'custom',
      path: ['telefono'],
      message: 'Ingresá un WhatsApp válido.',
    });
  }
});

type AuthInput = z.input<typeof authSchema>;
type RegisterInput = z.input<typeof registerSchema>;

async function userOwnsStore(
  supabase: BuyerServerClient,
  userId: string,
  email: string,
) {
  const { data: ownerById, error: ownerByIdError } = await supabase
    .from('tiendas')
    .select('id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (ownerByIdError) {
    console.error('No se pudo validar tienda por usuario para comprador', ownerByIdError);
  }

  if (ownerById) return true;

  const { data: ownerByEmail, error: ownerByEmailError } = await supabase
    .from('tiendas')
    .select('id')
    .ilike('contact_email', email)
    .limit(1)
    .maybeSingle();

  if (ownerByEmailError) {
    console.error('No se pudo validar tienda por correo para comprador', ownerByEmailError);
  }

  return Boolean(ownerByEmail);
}

function perfilSeguro(perfil: CompradorPerfilRow | null | undefined, fallbackEmail: string, fallbackNombre: string): CompradorPerfil {
  return {
    nombre: perfil?.nombre ?? fallbackNombre,
    email: perfil?.email ?? fallbackEmail,
    telefono: perfil?.telefono ?? null,
    direccion: perfil?.direccion ?? null,
    ciudad: perfil?.ciudad ?? null,
  };
}

async function prepareBuyerSessionInternal(supabase: BuyerServerClient): Promise<CompradorSesionResultado> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id || !user.email) return {};

  if (await userOwnsStore(supabase, user.id, user.email)) {
    await supabase.auth.signOut();
    return { blockedOwner: true, error: OWNER_BUYER_ERROR };
  }

  const { data: perfil, error: perfilError } = await supabase
    .from('compradores')
    .select('nombre, email, telefono, direccion, ciudad')
    .eq('user_id', user.id)
    .maybeSingle();

  if (perfilError) {
    console.error('No se pudo leer el perfil al preparar sesión comprador', perfilError);
    return { error: 'Entraste, pero no pudimos preparar tu perfil. Intentá de nuevo.' };
  }

  if (perfil) {
    return {
      comprador: perfilSeguro(perfil, user.email, user.email.split('@')[0] ?? 'Compradora'),
    };
  }

  const metadataName = typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : '';
  const metadataPhone = typeof user.user_metadata?.buyer_phone === 'string' ? user.user_metadata.buyer_phone : '';
  const fallbackNombre = metadataName.trim() || user.email.split('@')[0] || 'Compradora';
  const fallbackTelefono = metadataPhone.trim() || null;

  const { data: created, error } = await supabase
    .from('compradores')
    .upsert({
      user_id: user.id,
      nombre: fallbackNombre,
      email: user.email,
      telefono: fallbackTelefono,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    .select('nombre, email, telefono, direccion, ciudad')
    .single();

  if (error || !created) {
    console.error('No se pudo crear el perfil comprador', error);
    return { error: 'Entraste, pero no pudimos preparar tu perfil. Intentá de nuevo.' };
  }

  return { comprador: perfilSeguro(created, user.email, fallbackNombre) };
}

export async function iniciarSesionComprador(input: AuthInput): Promise<CompradorSesionResultado> {
  const guardError = await guardServerMutation('buyer:login', 12, 10 * 60);
  if (guardError) return { error: guardError };

  const parsed = authSchema.safeParse(input);
  if (!parsed.success) {
    return { error: 'Ingresá un correo válido y una contraseña de al menos 8 caracteres.' };
  }

  const supabase = await createBuyerClient();
  const { email, password } = parsed.data;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return { error: 'Correo o contraseña incorrectos.' };
  }

  return prepareBuyerSessionInternal(supabase);
}

export async function registrarComprador(input: RegisterInput): Promise<CompradorSesionResultado> {
  const guardError = await guardServerMutation('buyer:register', 8, 10 * 60);
  if (guardError) return { error: guardError };

  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return { error: 'Revisá los datos de tu cuenta e intentá de nuevo.' };
  }

  const supabase = await createBuyerClient();
  const { email, password, nombre, telefono } = parsed.data;

  const { data: ownerEmail } = await supabase
    .from('tiendas')
    .select('id')
    .ilike('contact_email', email)
    .limit(1)
    .maybeSingle();

  if (ownerEmail) {
    return { error: OWNER_BUYER_ERROR };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: nombre,
        buyer_phone: telefono || null,
      },
    },
  });

  if (error) {
    return { error: error.message.toLowerCase().includes('already') ? 'Ese correo ya tiene cuenta.' : error.message };
  }

  if (data.user && data.user.identities && data.user.identities.length === 0) {
    return { error: 'Ese correo ya tiene cuenta. Iniciá sesión como comprador.' };
  }

  if (!data.user) {
    return { error: 'No pudimos crear la cuenta. Intentá de nuevo.' };
  }

  if (!data.session) {
    return {
      notice: 'Te enviamos un correo de confirmación. Después de confirmarlo, iniciá sesión para guardar tu perfil.',
    };
  }

  return prepareBuyerSessionInternal(supabase);
}

export async function solicitarResetPasswordComprador(input: { email: string }): Promise<{ error?: string; sent?: boolean }> {
  const guardError = await guardServerMutation('buyer:reset', 5, 10 * 60);
  if (guardError) return { error: guardError };

  const email = input.email.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'Ingresá un correo válido.' };
  }

  const supabase = await createBuyerClient();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${APP_URL}/auth/callback?next=/auth/reset-password&scope=buyer`,
  });

  if (error) {
    console.error('No se pudo enviar recuperación de comprador', error);
  }

  return { sent: true };
}

export async function cerrarSesionComprador(): Promise<{ error?: string }> {
  const supabase = await createBuyerClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error('No se pudo cerrar la sesión comprador', error);
    return { error: 'No pudimos cerrar tu sesión. Intentá de nuevo.' };
  }

  return {};
}

export async function obtenerPerfilComprador(): Promise<CompradorSesionResultado> {
  const supabase = await createBuyerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id || !user.email) return {};

  if (await userOwnsStore(supabase, user.id, user.email)) {
    await supabase.auth.signOut();
    return { blockedOwner: true, error: OWNER_BUYER_ERROR };
  }

  const { data: perfil, error } = await supabase
    .from('compradores')
    .select('nombre, email, telefono, direccion, ciudad')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    console.error('No se pudo leer el perfil comprador', error);
    return { error: 'No pudimos cargar tu perfil. Intentá de nuevo.' };
  }

  if (!perfil) return {};

  return {
    comprador: perfilSeguro(perfil, user.email, user.email.split('@')[0] ?? 'Compradora'),
  };
}

export async function prepararSesionComprador(): Promise<CompradorSesionResultado> {
  const guardError = await guardServerMutation('buyer:prepare', 30, 10 * 60);
  if (guardError) return { error: guardError };

  const supabase = await createBuyerClient();
  const prepared = await prepareBuyerSessionInternal(supabase);
  if (!prepared.comprador && !prepared.error && !prepared.notice) {
    return { error: 'Iniciá sesión como comprador para continuar.' };
  }
  return prepared;
}

const PEDIDOS_PER_PAGE = 10;

export async function obtenerPedidosComprador(cursor?: string): Promise<{
  error?: string;
  blockedOwner?: boolean;
  pedidos?: CompradorPedidoResumen[];
  nextCursor?: string;
}> {
  const supabase = await createBuyerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id || !user.email) return {};

  if (await userOwnsStore(supabase, user.id, user.email)) {
    await supabase.auth.signOut();
    return { blockedOwner: true, error: OWNER_BUYER_ERROR };
  }

  let query = supabase
    .from('pedidos')
    .select(`
      id, numero, estado, monto_total, created_at, metodo_envio, apartado_expira_at,
      drop:drops(nombre),
      items:pedido_items(
        id, precio, talla_seleccionada,
        prenda:prendas(nombre, talla, marca, fotos)
      )
    `)
    .eq('comprador_email', user.email)
    .order('created_at', { ascending: false })
    .limit(PEDIDOS_PER_PAGE + 1);

  if (cursor) {
    query = query.lt('created_at', cursor);
  }

  const { data, error } = await query;

  if (error) {
    console.error('No se pudieron leer los pedidos comprador', error);
    return { error: 'No pudimos cargar tus pedidos. Intentá de nuevo.' };
  }

  const pedidos = data ?? [];
  const hasMore = pedidos.length > PEDIDOS_PER_PAGE;
  const page = hasMore ? pedidos.slice(0, PEDIDOS_PER_PAGE) : pedidos;
  const nextCursor = hasMore ? page[page.length - 1]?.created_at ?? undefined : undefined;

  return { pedidos: page, nextCursor };
}

export async function guardarPerfilComprador(input: PerfilInput): Promise<{
  error?: string;
  blockedOwner?: boolean;
  comprador?: CompradorPerfil;
}> {
  const guardError = await guardServerMutation('buyer:profile:update', 30, 10 * 60);
  if (guardError) return { error: guardError };

  const parsed = perfilSchema.safeParse(input);
  if (!parsed.success) {
    return { error: 'Revisá los datos del perfil e intentá de nuevo.' };
  }

  const supabase = await createBuyerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id || !user.email) {
    return { error: 'Iniciá sesión como compradora para editar tu perfil.' };
  }

  if (await userOwnsStore(supabase, user.id, user.email)) {
    await supabase.auth.signOut();
    return { blockedOwner: true, error: OWNER_BUYER_ERROR };
  }

  const data = parsed.data;
  const payload = {
    user_id: user.id,
    nombre: data.nombre,
    email: user.email,
    telefono: data.telefono,
    direccion: data.direccion,
    ciudad: data.ciudad,
    updated_at: new Date().toISOString(),
  };

  const { data: perfil, error } = await supabase
    .from('compradores')
    .upsert(payload, { onConflict: 'user_id' })
    .select('nombre, email, telefono, direccion, ciudad')
    .single();

  if (error || !perfil) {
    console.error('No se pudo guardar el perfil comprador', error);
    return { error: 'No pudimos guardar tu perfil. Intentá de nuevo.' };
  }

  return {
    comprador: {
      nombre: perfil.nombre ?? data.nombre,
      email: perfil.email ?? user.email,
      telefono: perfil.telefono,
      direccion: perfil.direccion,
      ciudad: perfil.ciudad,
    },
  };
}
