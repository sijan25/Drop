import { notFound, redirect } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';

export async function getPublicTiendaOrRedirect(username: string, suffix = '') {
  const service = await createServiceClient();
  const cleanUsername = username.trim();

  const { data: tienda } = await service
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

  const { data: usernameRedirect } = await service
    .from('tienda_username_redirects')
    .select('new_username')
    .ilike('old_username', cleanUsername)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (usernameRedirect?.new_username) {
    redirect(`/${usernameRedirect.new_username}${suffix}`);
  }

  notFound();
}
