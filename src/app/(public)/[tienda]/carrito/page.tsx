import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getPublicTiendaOrRedirect } from '@/lib/stores/public-store';
import { CarritoCheckoutClient } from './carrito-checkout-client';

export const dynamic = 'force-dynamic';

export default async function CarritoPage({
  params,
}: {
  params: Promise<{ tienda: string }>;
}) {
  const { tienda: username } = await params;
  const supabase = await createClient();
  const tienda = await getPublicTiendaOrRedirect(username, '/carrito');

  const { data: { user: sellerUser } } = await supabase.auth.getUser();
  const isOwnerPreview = sellerUser?.id === tienda.user_id;

  let tiendaEmail = tienda.contact_email ?? '';
  try {
    const admin = await createServiceClient();
    const { data } = await admin.auth.admin.getUserById(tienda.user_id);
    tiendaEmail = tiendaEmail || data.user?.email || '';
  } catch {
    tiendaEmail = tiendaEmail || '';
  }

  const { data: metodosPago } = await supabase
    .from('metodos_pago')
    .select('*')
    .eq('tienda_id', tienda.id)
    .eq('activo', true);

  const { data: metodosEnvio } = await supabase
    .from('metodos_envio')
    .select('*')
    .eq('tienda_id', tienda.id)
    .eq('activo', true)
    .order('precio', { ascending: true });

  return (
    <CarritoCheckoutClient
      tienda={tienda}
      metodosPago={metodosPago ?? []}
      metodosEnvio={metodosEnvio ?? []}
      tiendaEmail={tiendaEmail}
      isOwnerPreview={isOwnerPreview}
    />
  );
}
