'use server';

import { z } from 'zod';
import { guardServerMutation } from '@/lib/security/request';
import { createBuyerClient } from '@/lib/supabase/server';

const PHONE_RE = /^[+\d][\d\s().-]{6,39}$/;
const OWNER_BUYER_ERROR = 'Ese correo pertenece a una tienda. Usá otro correo para comprar o iniciá sesión como tienda.';

export type CompradorPerfil = {
  nombre: string;
  email: string;
  telefono: string | null;
  direccion: string | null;
  ciudad: string | null;
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

async function userOwnsStore(
  supabase: Awaited<ReturnType<typeof createBuyerClient>>,
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

export async function obtenerPerfilComprador(): Promise<{
  error?: string;
  blockedOwner?: boolean;
  comprador?: CompradorPerfil;
}> {
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

export async function prepararSesionComprador(): Promise<{
  error?: string;
  blockedOwner?: boolean;
  comprador?: CompradorPerfil;
}> {
  const guardError = await guardServerMutation('buyer:prepare', 30, 10 * 60);
  if (guardError) return { error: guardError };

  const supabase = await createBuyerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id || !user.email) {
    return { error: 'Iniciá sesión como comprador para continuar.' };
  }

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
