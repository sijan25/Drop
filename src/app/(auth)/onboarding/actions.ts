'use server';

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { guardServerMutation } from '@/lib/security/request';
import { validateStoreUsername } from '@/lib/stores/username';

export async function createAccount(data: {
  email: string;
  password: string;
  username: string;
  nombre: string;
  instagram: string | null;
  ubicacion: string | null;
  tipo_negocio: 'ropa' | 'zapatos' | 'mixto';
}): Promise<{ error?: string; needsConfirmation?: boolean }> {
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
    service
      .from('tiendas')
      .select('id')
      .ilike('username', username)
      .maybeSingle(),
    service
      .from('tienda_username_redirects')
      .select('id')
      .ilike('old_username', username)
      .maybeSingle(),
    service
      .from('tiendas')
      .select('id')
      .ilike('contact_email', email)
      .maybeSingle(),
  ]);

  if (existingUsername || existingRedirect) return { error: 'Ese link ya está en uso o reservado por una redirección existente.' };
  if (existingEmail) return { error: 'Ese correo ya pertenece a una tienda. Iniciá sesión.' };

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

  // Use service role to bypass RLS — at signup time no session exists yet
  const { error: insertError } = await service.from('tiendas').insert({
    user_id: userId,
    username,
    nombre,
    contact_email: email,
    instagram: data.instagram,
    ubicacion: data.ubicacion,
    plan: 'starter',
    activa: true,
    tipo_negocio: data.tipo_negocio,
  });

  if (insertError) {
    return { error: 'Error al guardar la tienda: ' + insertError.message };
  }

  // If session is null, Supabase requires email confirmation before signing in
  return { needsConfirmation: !signUpData.session };
}
