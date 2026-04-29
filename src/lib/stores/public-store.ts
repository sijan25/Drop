import { notFound, redirect } from 'next/navigation';
import { createClient, createServiceClient, getServiceRoleConfigError } from '@/lib/supabase/server';

export async function getPublicTiendaOrRedirect(username: string, suffix = '') {
  const supabase = await createClient();
  const cleanUsername = username.trim();

  const { data: tienda } = await supabase
    .from('tiendas')
    .select('*')
    .ilike('username', cleanUsername)
    .eq('activa', true)
    .maybeSingle();

  if (tienda) {
    if (tienda.username !== cleanUsername) {
      redirect(`/${tienda.username}${suffix}`);
    }
    return tienda;
  }

  let usernameRedirect: { new_username: string | null } | null = null;
  const serviceRoleError = getServiceRoleConfigError();

  if (!serviceRoleError) {
    const service = await createServiceClient();
    const { data } = await service
      .from('tienda_username_redirects')
      .select('new_username')
      .ilike('old_username', cleanUsername)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    usernameRedirect = data;
  }

  if (usernameRedirect?.new_username) {
    redirect(`/${usernameRedirect.new_username}${suffix}`);
  }

  notFound();
}
