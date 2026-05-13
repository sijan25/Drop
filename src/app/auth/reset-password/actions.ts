'use server';

import { createBuyerClient, createClient } from '@/lib/supabase/server';

type ResetPasswordScope = 'buyer' | 'seller';

export async function actualizarPasswordRecuperacion(input: {
  password: string;
  scope?: string | null;
}): Promise<{ ok?: boolean; error?: string }> {
  const password = input.password;
  const scope: ResetPasswordScope = input.scope === 'buyer' ? 'buyer' : 'seller';

  if (password.length < 8) {
    return { error: 'La contraseña debe tener al menos 8 caracteres.' };
  }

  const supabase = scope === 'buyer'
    ? await createBuyerClient()
    : await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { error: 'No autorizado. El link puede haber expirado.' };
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    console.error(`No se pudo actualizar contraseña de ${scope}`, error);
    return { error: 'No pudimos actualizar la contraseña. El link puede haber expirado.' };
  }

  return { ok: true };
}
