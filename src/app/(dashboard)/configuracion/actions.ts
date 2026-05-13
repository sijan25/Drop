'use server';

import { revalidatePath } from 'next/cache';
import { parsePhoneNumberWithError } from 'libphonenumber-js';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getCatalogDefaults, type CatalogOptionTipo, type TipoNegocio } from '@/lib/catalog-options';
import { guardServerMutation } from '@/lib/security/request';
import { encryptPixelPaySecret } from '@/lib/pixelpay/security';
import { encryptBoxfulPassword } from '@/lib/boxful/security';
import {
  STORE_USERNAME_TAKEN_ERROR,
  USERNAME_CHANGE_COOLDOWN_DAYS,
  USERNAME_CHANGE_LIMIT,
  normalizeStoreUsername,
  validateStoreUsername,
} from '@/lib/stores/username';
import type { MetodoPago, MetodoEnvio } from '@/types/envio';
import type { OpcionCatalogo } from '@/types/catalog';
import type { TiendaUpdate } from '@/types/tienda';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeWhatsapp(value: string): { value: string | null; error?: string } {
  const raw = value.trim();
  if (!raw) return { value: null };

  try {
    const parsed = parsePhoneNumberWithError(raw.startsWith('+') ? raw : `+${raw}`);
    if (!parsed.isValid()) {
      return { value: null, error: 'Ingresá un número de WhatsApp válido.' };
    }
    return { value: parsed.number };
  } catch {
    return { value: null, error: 'Ingresá un número de WhatsApp válido.' };
  }
}

async function getTiendaId() {
  const guardError = await guardServerMutation('dashboard:config', 180, 10 * 60);
  if (guardError) return { error: guardError, tiendaId: null, supabase: null };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'No autorizado' as const, tiendaId: null, supabase: null };

  const { data: tienda } = await supabase
    .from('tiendas')
    .select('id, tipo_negocio')
    .eq('user_id', user.id)
    .single();

  if (!tienda) return { error: 'Tienda no encontrada' as const, tiendaId: null, supabase: null };
  return { error: null, tiendaId: tienda.id, tipoNegocio: (tienda.tipo_negocio as TipoNegocio) ?? 'ropa', supabase };
}

function mensajeGuardarTienda(message: string) {
  if (
    message.includes('schema cache') &&
    (message.includes("'facebook' column") || message.includes("'tiktok' column"))
  ) {
    return 'Falta aplicar la migración de redes sociales en Supabase. Aplicá la migración y volvé a intentar.';
  }
  return message;
}

export async function guardarInfoTienda(data: {
  nombre: string;
  username: string;
  contact_email: string;
  bio: string;
  instagram: string;
  facebook: string;
  tiktok: string;
  ubicacion: string;
  ciudad: string;
  departamento: string;
  whatsapp: string;
  pais?: string;
  moneda?: string;
  simbolo_moneda?: string;
  codigo_telefono?: string;
  logo_url?: string | null;
  logo_cloudinary_id?: string | null;
  cover_url?: string | null;
}): Promise<{ error?: string }> {
  const { error: authError, tiendaId, supabase } = await getTiendaId();
  if (authError || !supabase) return { error: authError ?? 'Error' };

  const usernameValidation = validateStoreUsername(data.username);
  const username = usernameValidation.username;
  const contactEmail = data.contact_email.trim().toLowerCase();

  if (usernameValidation.error) {
    return { error: usernameValidation.error };
  }

  if (!contactEmail || !EMAIL_RE.test(contactEmail)) {
    return { error: 'Ingresá un correo público válido.' };
  }

  const whatsapp = normalizeWhatsapp(data.whatsapp);
  if (whatsapp.error) {
    return { error: whatsapp.error };
  }

  const service = await createServiceClient();
  const { data: current } = await service
    .from('tiendas')
    .select('username, username_changed_at, username_change_count')
    .eq('id', tiendaId!)
    .single();

  if (!current) return { error: 'Tienda no encontrada' };

  const [{ data: existingUsername }, { data: existingRedirect }, { data: existingEmail }] = await Promise.all([
    service
      .from('tiendas')
      .select('id, username')
      .ilike('username', username)
      .neq('id', tiendaId!)
      .maybeSingle(),
    service
      .from('tienda_username_redirects')
      .select('tienda_id')
      .ilike('old_username', username)
      .neq('tienda_id', tiendaId!)
      .maybeSingle(),
    service
      .from('tiendas')
      .select('id')
      .ilike('contact_email', contactEmail)
      .neq('id', tiendaId!)
      .maybeSingle(),
  ]);

  if (existingUsername || existingRedirect) return { error: STORE_USERNAME_TAKEN_ERROR };
  if (existingEmail) return { error: 'Ese correo público ya pertenece a otra tienda.' };

  const currentUsername = current.username;
  const usernameChanged = normalizeStoreUsername(currentUsername) !== username;
  const updateData: TiendaUpdate = {
    nombre: data.nombre.trim(),
    username: usernameChanged ? username : currentUsername,
    contact_email: contactEmail,
    bio: data.bio || null,
    instagram: data.instagram || null,
    facebook: data.facebook || null,
    tiktok: data.tiktok || null,
    ubicacion: data.ubicacion || null,
    ciudad: data.ciudad || null,
    departamento: data.departamento || null,
    whatsapp: whatsapp.value,
    pais: data.pais?.trim() || 'Honduras',
    moneda: data.moneda?.trim().toUpperCase() || 'HNL',
    simbolo_moneda: data.simbolo_moneda?.trim() || 'L',
    codigo_telefono: data.codigo_telefono?.trim() || '+504',
    ...(data.logo_url !== undefined ? { logo_url: data.logo_url } : {}),
    ...(data.logo_cloudinary_id !== undefined ? { logo_cloudinary_id: data.logo_cloudinary_id } : {}),
    ...(data.cover_url !== undefined ? { cover_url: data.cover_url } : {}),
  };

  if (usernameChanged) {
    const changeCount = current.username_change_count ?? 0;
    if (changeCount >= USERNAME_CHANGE_LIMIT) {
      return { error: `Ya alcanzaste el máximo de ${USERNAME_CHANGE_LIMIT} cambios de link público.` };
    }

    if (current.username_changed_at) {
      const lastChange = new Date(current.username_changed_at).getTime();
      const availableAt = lastChange + USERNAME_CHANGE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
      if (Number.isFinite(lastChange) && Date.now() < availableAt) {
        const date = new Date(availableAt).toLocaleDateString('es-HN', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        });
        return { error: `Podés cambiar el link nuevamente el ${date}.` };
      }
    }

    updateData.username_changed_at = new Date().toISOString();
    updateData.username_change_count = changeCount + 1;
  }

  const { error } = await supabase
    .from('tiendas')
    .update(updateData)
    .eq('id', tiendaId!);

  if (error) {
    if (error.code === '23505') return { error: STORE_USERNAME_TAKEN_ERROR };
    return { error: mensajeGuardarTienda(error.message) };
  }

  if (usernameChanged) {
    await service
      .from('tienda_username_redirects')
      .update({ new_username: username })
      .eq('tienda_id', tiendaId!);

    const { error: redirectError } = await service
      .from('tienda_username_redirects')
      .insert({
        tienda_id: tiendaId!,
        old_username: currentUsername,
        new_username: username,
      });

    if (redirectError?.code === '23505') {
      await service
        .from('tienda_username_redirects')
        .update({ tienda_id: tiendaId!, new_username: username })
        .ilike('old_username', currentUsername);
    }
  }

  revalidatePath('/configuracion');
  revalidatePath(`/${username}`);
  if (currentUsername && currentUsername !== username) {
    revalidatePath(`/${currentUsername}`);
  }
  return {};
}

// ── MÉTODOS DE PAGO ─────────────────────────────────────

export async function agregarMetodoPago(data: {
  tipo: 'tarjeta' | 'transferencia';
  proveedor: string;
  nombre: string;
  detalle?: string;
}): Promise<{ error?: string; metodo?: MetodoPago }> {
  const { error: authError, tiendaId, supabase } = await getTiendaId();
  if (authError || !supabase) return { error: authError ?? 'Error' };

  const { data: metodo, error } = await supabase
    .from('metodos_pago')
    .insert({
      tienda_id: tiendaId!,
      tipo: data.tipo,
      proveedor: data.proveedor,
      nombre: data.nombre,
      detalle: data.detalle || null,
      activo: true,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath('/configuracion');
  return { metodo };
}

export async function toggleMetodoPago(id: string, activo: boolean): Promise<{ error?: string }> {
  const { error: authError, tiendaId, supabase } = await getTiendaId();
  if (authError || !supabase) return { error: authError ?? 'Error' };

  const { error } = await supabase
    .from('metodos_pago')
    .update({ activo })
    .eq('id', id)
    .eq('tienda_id', tiendaId!);

  if (error) return { error: error.message };

  revalidatePath('/configuracion');
  return {};
}

export async function eliminarMetodoPago(id: string): Promise<{ error?: string }> {
  const { error: authError, tiendaId, supabase } = await getTiendaId();
  if (authError || !supabase) return { error: authError ?? 'Error' };

  const { error } = await supabase
    .from('metodos_pago')
    .delete()
    .eq('id', id)
    .eq('tienda_id', tiendaId!);

  if (error) return { error: error.message };

  revalidatePath('/configuracion');
  return {};
}

// ── MÉTODOS DE ENVÍO ─────────────────────────────────────

export async function agregarMetodoEnvio(data: {
  nombre: string;
  proveedor: string;
  precio: number;
  tiempo_estimado: string;
  cobertura: string;
  tracking_url: string;
}): Promise<{ error?: string; metodo?: MetodoEnvio }> {
  const { error: authError, tiendaId, supabase } = await getTiendaId();
  if (authError || !supabase) return { error: authError ?? 'Error' };

  const { data: metodo, error } = await supabase
    .from('metodos_envio')
    .insert({
      tienda_id: tiendaId!,
      nombre: data.nombre,
      proveedor: data.proveedor,
      precio: data.precio,
      tiempo_estimado: data.tiempo_estimado || 'Por confirmar',
      cobertura: data.cobertura || 'Por confirmar',
      tracking_url: data.tracking_url || null,
      activo: true,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath('/configuracion');
  return { metodo };
}

export async function editarMetodoEnvio(id: string, data: {
  nombre: string;
  proveedor: string;
  precio: number;
  tiempo_estimado: string;
  cobertura: string;
  tracking_url: string;
}): Promise<{ error?: string; metodo?: MetodoEnvio }> {
  const { error: authError, tiendaId, supabase } = await getTiendaId();
  if (authError || !supabase) return { error: authError ?? 'Error' };

  const { data: metodo, error } = await supabase
    .from('metodos_envio')
    .update({
      nombre: data.nombre,
      proveedor: data.proveedor,
      precio: data.precio,
      tiempo_estimado: data.tiempo_estimado || 'Por confirmar',
      cobertura: data.cobertura || 'Por confirmar',
      tracking_url: data.tracking_url || null,
    })
    .eq('id', id)
    .eq('tienda_id', tiendaId!)
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath('/configuracion');
  return { metodo };
}

export async function toggleMetodoEnvio(id: string, activo: boolean): Promise<{ error?: string }> {
  const { error: authError, tiendaId, supabase } = await getTiendaId();
  if (authError || !supabase) return { error: authError ?? 'Error' };

  const { error } = await supabase
    .from('metodos_envio')
    .update({ activo })
    .eq('id', id)
    .eq('tienda_id', tiendaId!);

  if (error) return { error: error.message };

  revalidatePath('/configuracion');
  return {};
}

// ── OPCIONES DE CATÁLOGO ─────────────────────────────────

function normalizeCatalogOptionName(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function validateCatalogOptionName(tipo: CatalogOptionTipo, value: string) {
  if (!value) return 'Escribí un nombre para agregarlo.';
  const max = tipo === 'talla' ? 24 : 48;
  if (value.length > max) return tipo === 'talla' ? 'La talla es demasiado larga.' : 'La categoría es demasiado larga.';
  if (/[<>]/.test(value)) return 'Usá texto simple, sin símbolos especiales.';
  return null;
}

function getBaseOptions(tipoNegocio: TipoNegocio, tipo: CatalogOptionTipo) {
  const defaults = getCatalogDefaults(tipoNegocio);
  return tipo === 'categoria' ? defaults.categorias : defaults.tallas;
}

export async function agregarOpcionCatalogo(data: {
  tipo: 'categoria' | 'talla';
  nombre: string;
}): Promise<{ error?: string; opcion?: OpcionCatalogo }> {
  const { error: authError, tiendaId, supabase } = await getTiendaId();
  if (authError || !supabase) return { error: authError ?? 'Error' };

  const nombre = normalizeCatalogOptionName(data.nombre);
  const validationError = validateCatalogOptionName(data.tipo, nombre);
  if (validationError) return { error: validationError };

  const lowerNombre = nombre.toLowerCase();

  const { data: existingOptions, error: existingError } = await supabase
    .from('opciones_catalogo')
    .select('*')
    .eq('tienda_id', tiendaId!)
    .eq('tipo', data.tipo);

  if (existingError) return { error: existingError.message };

  const existing = (existingOptions ?? []).find(option => option.nombre.trim().toLowerCase() === lowerNombre);

  if (existing) {
    if (!existing.activo) {
      const { data: restored, error } = await supabase
        .from('opciones_catalogo')
        .update({ activo: true, nombre })
        .eq('id', existing.id)
        .eq('tienda_id', tiendaId!)
        .select()
        .single();

      if (error) return { error: error.message };
      revalidatePath('/configuracion');
      return { opcion: restored };
    }
    return { error: 'Esa opción ya existe en tu catálogo.' };
  }

  const { data: opcion, error } = await supabase
    .from('opciones_catalogo')
    .insert({
      tienda_id: tiendaId!,
      tipo: data.tipo,
      nombre,
      activo: true,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') return { error: 'Esa opción ya existe en tu catálogo.' };
    return { error: error.message };
  }
  if (!opcion) return { error: 'No se pudo crear la opción.' };

  revalidatePath('/configuracion');
  return { opcion };
}

export async function ocultarOpcionBaseCatalogo(data: {
  tipo: 'categoria' | 'talla';
  nombre: string;
}): Promise<{ error?: string; opcion?: OpcionCatalogo }> {
  const { error: authError, tiendaId, tipoNegocio, supabase } = await getTiendaId();
  if (authError || !supabase) return { error: authError ?? 'Error' };

  const nombre = normalizeCatalogOptionName(data.nombre);
  const validationError = validateCatalogOptionName(data.tipo, nombre);
  if (validationError) return { error: validationError };

  const base = getBaseOptions(tipoNegocio ?? 'ropa', data.tipo);
  const baseName = base.find(option => option.toLowerCase() === nombre.toLowerCase());
  if (!baseName) return { error: 'Solo podés ocultar opciones base de tu tipo de tienda.' };

  const { data: existingOptions, error: existingError } = await supabase
    .from('opciones_catalogo')
    .select('*')
    .eq('tienda_id', tiendaId!)
    .eq('tipo', data.tipo);

  if (existingError) return { error: existingError.message };

  const existing = (existingOptions ?? []).find(option => option.nombre.trim().toLowerCase() === baseName.toLowerCase());
  const query = existing
    ? supabase
        .from('opciones_catalogo')
        .update({ activo: false, nombre: baseName })
        .eq('id', existing.id)
        .eq('tienda_id', tiendaId!)
    : supabase
        .from('opciones_catalogo')
        .insert({
          tienda_id: tiendaId!,
          tipo: data.tipo,
          nombre: baseName,
          activo: false,
        });

  const { data: opcion, error } = await query.select().single();

  if (error) {
    if (error.code === '23505') return { error: 'Esa opción ya existe en tu catálogo.' };
    return { error: error.message };
  }
  if (!opcion) return { error: 'No se pudo ocultar la opción.' };

  revalidatePath('/configuracion');
  return { opcion };
}

export async function toggleOpcionCatalogo(id: string, activo: boolean): Promise<{ error?: string }> {
  const { error: authError, tiendaId, supabase } = await getTiendaId();
  if (authError || !supabase) return { error: authError ?? 'Error' };

  const { error } = await supabase
    .from('opciones_catalogo')
    .update({ activo })
    .eq('id', id)
    .eq('tienda_id', tiendaId!);

  if (error) return { error: error.message };

  revalidatePath('/configuracion');
  return {};
}

export async function eliminarOpcionCatalogo(id: string): Promise<{ error?: string }> {
  const { error: authError, tiendaId, supabase } = await getTiendaId();
  if (authError || !supabase) return { error: authError ?? 'Error' };

  const { error } = await supabase
    .from('opciones_catalogo')
    .delete()
    .eq('id', id)
    .eq('tienda_id', tiendaId!);

  if (error) return { error: error.message };

  revalidatePath('/configuracion');
  return {};
}

export async function resetearCatalogo(): Promise<{ error?: string; opciones?: OpcionCatalogo[] }> {
  const { error: authError, tiendaId, tipoNegocio, supabase } = await getTiendaId();
  if (authError || !supabase) return { error: authError ?? 'Error' };

  const { error: delError } = await supabase
    .from('opciones_catalogo')
    .delete()
    .eq('tienda_id', tiendaId!);

  if (delError) return { error: delError.message };

  const defaults = getCatalogDefaults(tipoNegocio ?? 'ropa');
  const rows = [
    ...defaults.categorias.map((nombre, orden) => ({ tienda_id: tiendaId!, tipo: 'categoria' as const, nombre, activo: true, orden })),
    ...defaults.tallas.map((nombre, orden) => ({ tienda_id: tiendaId!, tipo: 'talla' as const, nombre, activo: true, orden })),
  ];

  const { data: inserted, error: insertError } = await supabase
    .from('opciones_catalogo')
    .insert(rows)
    .select();

  if (insertError) return { error: insertError.message };

  revalidatePath('/configuracion');
  return { opciones: (inserted ?? []) as OpcionCatalogo[] };
}

export async function guardarPixelPayCredenciales(data: {
  sandbox: boolean;
  enabled: boolean;
  endpoint: string;
  keyId: string;
  secretKey: string;
}): Promise<{ error?: string }> {
  const { error: authError, tiendaId, supabase } = await getTiendaId();
  if (authError || !supabase) return { error: authError ?? 'Error' };

  const update: Record<string, unknown> = {
    pixelpay_sandbox: data.sandbox,
    pixelpay_enabled: data.enabled,
  };

  if (!data.sandbox) {
    const svc = await createServiceClient();
    const { data: current } = await svc
      .from('tiendas')
      .select('pixelpay_secret_key')
      .eq('id', tiendaId!)
      .maybeSingle();

    if (!data.endpoint || !data.keyId || (!data.secretKey && !current?.pixelpay_secret_key)) {
      return { error: 'Completá endpoint, Key ID y Secret Key de producción.' };
    }
    update.pixelpay_endpoint = data.endpoint.trim();
    update.pixelpay_key_id = data.keyId.trim();
    if (data.secretKey.trim()) {
      try {
        update.pixelpay_secret_key = encryptPixelPaySecret(data.secretKey);
      } catch {
        return { error: 'No se pudo cifrar el Secret Key. Configurá PIXELPAY_CREDENTIALS_SECRET.' };
      }
    }
  }

  const { error } = await supabase
    .from('tiendas')
    .update(update)
    .eq('id', tiendaId!);

  if (error) return { error: error.message };

  // Sync metodos_pago: create or deactivate the PixelPay method
  const { data: existing } = await supabase
    .from('metodos_pago')
    .select('id')
    .eq('tienda_id', tiendaId!)
    .eq('tipo', 'tarjeta')
    .maybeSingle();

  if (data.enabled) {
    if (existing) {
      await supabase.from('metodos_pago').update({ activo: true }).eq('id', existing.id);
    } else {
      await supabase.from('metodos_pago').insert({
        tienda_id: tiendaId!,
        tipo: 'tarjeta',
        nombre: 'PixelPay',
        proveedor: 'pixelpay',
        activo: true,
      });
    }
  } else if (existing) {
    await supabase.from('metodos_pago').update({ activo: false }).eq('id', existing.id);
  }

  revalidatePath('/configuracion');
  return {};
}

export async function eliminarMetodoEnvio(id: string): Promise<{ error?: string }> {
  const { error: authError, tiendaId, supabase } = await getTiendaId();
  if (authError || !supabase) return { error: authError ?? 'Error' };

  const { error } = await supabase
    .from('metodos_envio')
    .delete()
    .eq('id', id)
    .eq('tienda_id', tiendaId!);

  if (error) return { error: error.message };

  revalidatePath('/configuracion');
  return {};
}

export async function guardarBoxfulCredenciales(data: {
  email: string;
  password: string;
  enabled: boolean;
}): Promise<{ error?: string }> {
  const { error: authError, tiendaId, supabase } = await getTiendaId();
  if (authError || !supabase) return { error: authError ?? 'Error' };

  if (data.enabled && (!data.email.trim() || !data.password.trim())) {
    return { error: 'Ingresá tu email y contraseña de Boxful.' };
  }

  let encryptedPassword: string | null = null;
  if (data.password.trim()) {
    try {
      encryptedPassword = encryptBoxfulPassword(data.password);
    } catch {
      return { error: 'No se pudo cifrar la contraseña. Configurá PIXELPAY_CREDENTIALS_SECRET.' };
    }
  }

  if (data.enabled && !encryptedPassword) {
    const svc = await createServiceClient();
    const { data: current } = await svc
      .from('tiendas')
      .select('boxful_password')
      .eq('id', tiendaId!)
      .maybeSingle();
    if (!current?.boxful_password) {
      return { error: 'Ingresá tu contraseña de Boxful.' };
    }
  }

  const update: Record<string, unknown> = {
    boxful_enabled: data.enabled,
    boxful_email: data.email.trim() || null,
  };
  if (encryptedPassword) update.boxful_password = encryptedPassword;

  const { error } = await supabase
    .from('tiendas')
    .update(update)
    .eq('id', tiendaId!);

  if (error) return { error: error.message };

  revalidatePath('/configuracion');
  return {};
}
