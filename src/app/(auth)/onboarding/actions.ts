'use server';

import { createClient, createServiceClient, getServiceRoleConfigError } from '@/lib/supabase/server';
import { guardServerMutation } from '@/lib/security/request';
import { STORE_USERNAME_TAKEN_ERROR, validateStoreUsername } from '@/lib/stores/username';
import { encryptPixelPaySecret } from '@/lib/pixelpay/security';

export async function createAccount(data: {
  email: string;
  password: string;
  username: string;
  nombre: string;
  instagram: string | null;
  tiktok: string | null;
  facebook: string | null;
  ubicacion: string | null;
  departamento: string | null;
  ciudad: string | null;
  tipo_negocio: 'ropa' | 'zapatos' | 'mixto';
  metodosEnvio: { nombre: string; proveedor: string; precio: number; tiempoEstimado: string | null; cobertura: string | null; trackingUrl: string | null }[];
  cuentaBancaria: { banco: string; cuenta: string; titular: string } | null;
  pixelpay: { sandbox: boolean; endpoint: string; keyId: string; secretKey: string } | null;
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
    return { error: STORE_USERNAME_TAKEN_ERROR };
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

  let encryptedPixelPaySecret: string | null = null;
  if (data.pixelpay && !data.pixelpay.sandbox) {
    if (!data.pixelpay.endpoint || !data.pixelpay.keyId || !data.pixelpay.secretKey) {
      return { error: 'Completá las credenciales de PixelPay o usá modo sandbox.' };
    }
    try {
      encryptedPixelPaySecret = encryptPixelPaySecret(data.pixelpay.secretKey);
    } catch {
      await service.auth.admin.deleteUser(userId);
      return { error: 'No se pudo cifrar el Secret Key. Configurá PIXELPAY_CREDENTIALS_SECRET.' };
    }
  }

  const insertPayload = {
    user_id: userId,
    username,
    nombre,
    contact_email: email,
    instagram: data.instagram,
    tiktok: data.tiktok,
    facebook: data.facebook,
    ubicacion: data.ubicacion,
    departamento: data.departamento,
    ciudad: data.ciudad,
    plan: 'starter',
    activa: true,
    tipo_negocio: data.tipo_negocio,
    order_prefix: username.slice(0, 4).toUpperCase(),
    ...(data.pixelpay ? {
      pixelpay_enabled: true,
      pixelpay_sandbox: data.pixelpay.sandbox,
      ...(!data.pixelpay.sandbox ? {
        pixelpay_endpoint: data.pixelpay.endpoint,
        pixelpay_key_id: data.pixelpay.keyId,
        pixelpay_secret_key: encryptedPixelPaySecret,
      } : {}),
    } : {}),
  };

  const { error: insertError } = await service.from('tiendas').insert(insertPayload);

  if (insertError) {
    await service.auth.admin.deleteUser(userId);
    if (insertError.code === '23505') return { error: STORE_USERNAME_TAKEN_ERROR };
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

    if (data.metodosEnvio.length > 0) {
      await service.from('metodos_envio').insert(
        data.metodosEnvio.map(m => ({
          tienda_id: tiendaCreada.id,
          nombre: m.nombre,
          proveedor: m.proveedor,
          precio: m.precio,
          tiempo_estimado: m.tiempoEstimado,
          cobertura: m.cobertura,
          tracking_url_template: m.trackingUrl,
          activo: true,
        }))
      );
    }
  }

  return { needsConfirmation: !signUpData.session };
}
