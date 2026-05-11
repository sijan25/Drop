import { notFound } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getPublicTiendaOrRedirect } from '@/lib/stores/public-store';
import { PrendaPageClient } from '@/components/public/prenda-page-client';

export default async function PrendaPage({
  params,
}: {
  params: Promise<{ tienda: string; dropId: string; prendaId: string }>;
}) {
  const { tienda: username, dropId, prendaId } = await params;
  const supabase = await createClient();
  const tienda = await getPublicTiendaOrRedirect(username, `/drop/${dropId}/prenda/${prendaId}`);

  let tiendaEmail = tienda.contact_email ?? '';
  try {
    const admin = await createServiceClient();
    const { data } = await admin.auth.admin.getUserById(tienda.user_id);
    tiendaEmail = tiendaEmail || data.user?.email || '';
  } catch {
    tiendaEmail = tiendaEmail || '';
  }

  const { data: drop } = await supabase
    .from('drops')
    .select('*')
    .eq('id', dropId)
    .eq('tienda_id', tienda.id)
    .single();

  if (!drop) notFound();

  const { data: prenda } = await supabase
    .from('prendas')
    .select('*')
    .eq('id', prendaId)
    .eq('drop_id', dropId)
    .single();

  if (!prenda) notFound();

  const { data: metodosPago } = await supabase
    .from('metodos_pago')
    .select('*')
    .eq('tienda_id', tienda.id)
    .eq('activo', true);

  const { data: metodosEnvio, error: envioError } = await supabase
    .from('metodos_envio')
    .select('*')
    .eq('tienda_id', tienda.id)
    .eq('activo', true)
    .order('precio', { ascending: true });

  if (envioError) {
    console.error('[metodos_envio] Error cargando métodos de envío:', envioError.message, envioError.details);
  }

  // otras prendas del drop para sugerencias
  const { data: otrasPrendas } = await supabase
    .from('prendas')
    .select('id, nombre, marca, talla, tallas, cantidades_por_talla, cantidad, precio, fotos, estado')
    .eq('drop_id', dropId)
    .neq('id', prendaId)
    .eq('estado', 'disponible')
    .limit(4);

  return (
    <PrendaPageClient
      tienda={tienda}
      drop={drop}
      prenda={prenda}
      metodosPago={metodosPago ?? []}
      metodosEnvio={metodosEnvio ?? []}
      otrasPrendas={otrasPrendas ?? []}
      tiendaEmail={tiendaEmail}
    />
  );
}
