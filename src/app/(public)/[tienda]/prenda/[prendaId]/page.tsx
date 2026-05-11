import { notFound } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getPublicTiendaOrRedirect } from '@/lib/stores/public-store';
import { PrendaPageClient } from '@/components/public/prenda-page-client';

export const dynamic = 'force-dynamic';

export default async function PrendaCatalogoPage({
  params,
}: {
  params: Promise<{ tienda: string; prendaId: string }>;
}) {
  const { tienda: username, prendaId } = await params;
  const supabase = await createClient();
  const tienda = await getPublicTiendaOrRedirect(username, `/prenda/${prendaId}`);

  let tiendaEmail = tienda.contact_email ?? '';
  try {
    const admin = await createServiceClient();
    const { data } = await admin.auth.admin.getUserById(tienda.user_id);
    tiendaEmail = tiendaEmail || data.user?.email || '';
  } catch {
    tiendaEmail = tiendaEmail || '';
  }

  const { data: prenda } = await supabase
    .from('prendas')
    .select('*')
    .eq('id', prendaId)
    .eq('tienda_id', tienda.id)
    .is('drop_id', null)
    .single();

  if (!prenda) notFound();

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

  const { data: otrasPrendas } = await supabase
    .from('prendas')
    .select('id, nombre, marca, talla, tallas, cantidades_por_talla, cantidad, precio, fotos, estado')
    .eq('tienda_id', tienda.id)
    .is('drop_id', null)
    .neq('id', prendaId)
    .eq('estado', 'disponible')
    .gt('cantidad', 0)
    .limit(4);

  return (
    <PrendaPageClient
      tienda={tienda}
      prenda={prenda}
      metodosPago={metodosPago ?? []}
      metodosEnvio={metodosEnvio ?? []}
      otrasPrendas={otrasPrendas ?? []}
      tiendaEmail={tiendaEmail}
    />
  );
}
