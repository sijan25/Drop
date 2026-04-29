'use server';

import { createClient, createServiceClient, getServiceRoleConfigError } from '@/lib/supabase/server';
import { PLATFORM } from '@/lib/config/platform';
import { guardServerMutation } from '@/lib/security/request';
import { validateStoreUsername } from '@/lib/stores/username';

export async function createAccount(data: {
  email: string;
  password: string;
  username: string;
  nombre: string;
  instagram: string | null;
  tiktok: string | null;
  facebook: string | null;
  ubicacion: string | null;
  tipo_negocio: 'ropa' | 'zapatos' | 'mixto';
  envios: { domicilio: boolean; nacional: boolean };
  cuentaBancaria: { banco: string; cuenta: string; titular: string } | null;
}): Promise<{ error?: string; needsConfirmation?: boolean }> {
  const serviceRoleError = getServiceRoleConfigError();
  if (serviceRoleError) return { error: 'Error de configuración del servidor: ' + serviceRoleError };

  const guardError = await guardServerMutation('store:create-account', 5, 60 * 60, data.email);
  if (guardError) return { error: guardError };

  const supabase = await createClient();
  const service = await createServiceClient();
  const email = data.email.trim().toLowerCase();
  const usernameValidation = validateStoreUsername(data.username);
  const username = usernameValidation.username;
  const nombre = data.nombre.trim();

  if (usernameValidation.error) {
    return { error: usernameValidation.error };
  }

  const [{ data: existingUsername }, { data: existingRedirect }, { data: existingEmail }] = await Promise.all([
    service.from('tiendas').select('id').ilike('username', username).maybeSingle(),
    service.from('tienda_username_redirects').select('id').ilike('old_username', username).maybeSingle(),
    service.from('tiendas').select('id').ilike('contact_email', email).maybeSingle(),
  ]);

  if (existingUsername || existingRedirect)
    return { error: 'Ese link ya está en uso o reservado por una redirección existente.' };
  if (existingEmail)
    return { error: 'Ese correo ya pertenece a una tienda. Iniciá sesión.' };

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password: data.password,
  });

  if (signUpError) {
    const msg = signUpError.message.toLowerCase();
    if (msg.includes('already registered') || msg.includes('already exists')) {
      return { error: 'Ese correo ya tiene cuenta. Iniciá sesión.' };
    }
    return { error: signUpError.message };
  }

  if (signUpData.user?.identities?.length === 0) {
    return { error: 'Ese correo ya tiene cuenta. Iniciá sesión.' };
  }

  const userId = signUpData.user?.id;
  if (!userId) return { error: 'Error inesperado al crear la cuenta.' };

  // Intentar insert completo primero (con tipo_negocio)
  const insertPayload: Record<string, unknown> = {
    user_id: userId,
    username,
    nombre,
    contact_email: email,
    instagram: data.instagram,
    tiktok: data.tiktok,
    facebook: data.facebook,
    ubicacion: data.ubicacion,
    plan: 'starter',
    activa: true,
    tipo_negocio: data.tipo_negocio,
  };

  let insertError = (await service.from('tiendas').insert(insertPayload)).error;

  // Si falla por columna tipo_negocio no existente, reintentar sin ella
  if (insertError) {
    const msg = insertError.message ?? '';
    const esMissingColumn =
      msg.includes('tipo_negocio') ||
      msg.includes('schema cache') ||
      msg.includes('column') ||
      msg.includes('does not exist');

    if (esMissingColumn) {
      const { tipo_negocio, ...sinTipoNegocio } = insertPayload;
      void tipo_negocio; // suppress unused warning
      const retry = await service.from('tiendas').insert(sinTipoNegocio);
      insertError = retry.error ?? null;
    }
  }

  if (insertError) {
    await service.auth.admin.deleteUser(userId);
    return { error: 'Error al guardar la tienda: ' + insertError.message };
  }

  // Obtener el id de la tienda recién creada para insertar métodos de envío
  const { data: tiendaCreada } = await service
    .from('tiendas')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (tiendaCreada) {
    if (data.cuentaBancaria) {
      const { banco, cuenta, titular } = data.cuentaBancaria;
      await service.from('metodos_pago').insert({
        tienda_id: tiendaCreada.id,
        tipo: 'transferencia',
        proveedor: banco,
        nombre: banco,
        detalle: titular ? `${cuenta} · ${titular}` : cuenta,
        activo: true,
      });
    }

    const metodosBase = [
      { nombre: 'Retiro en tienda', proveedor: 'Retiro', precio: 0, tiempo_estimado: null, cobertura: 'Local', activo: true },
      ...(data.envios.domicilio ? [{ nombre: 'Envío en ciudad', proveedor: 'Mensajería local', precio: 60, tiempo_estimado: '1-2 días', cobertura: 'Ciudad', activo: true }] : []),
      ...(data.envios.nacional ? [{ nombre: 'Envío nacional', proveedor: 'Mensajería nacional', precio: 120, tiempo_estimado: '2-3 días', cobertura: `Todo ${PLATFORM.country}`, activo: true }] : []),
    ];
    await service.from('metodos_envio').insert(
      metodosBase.map(m => ({ ...m, tienda_id: tiendaCreada.id }))
    );
  }

  return { needsConfirmation: !signUpData.session };
}
