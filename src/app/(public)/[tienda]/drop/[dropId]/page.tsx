import { notFound } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getPublicTiendaOrRedirect } from '@/lib/stores/public-store';
import { DropPageClient } from './drop-page-client';

export default async function DropPage({ params }: { params: Promise<{ tienda: string; dropId: string }> }) {
  const { tienda: username, dropId } = await params;
  const supabase = await createClient();
  const tienda = await getPublicTiendaOrRedirect(username, `/drop/${dropId}`);

  const { data: drop } = await supabase
    .from('drops')
    .select('*')
    .eq('id', dropId)
    .eq('tienda_id', tienda.id)
    .single();

  if (!drop) notFound();

  const { data: prendas } = await supabase
    .from('prendas')
    .select('*')
    .eq('drop_id', dropId)
    .order('created_at', { ascending: true });

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

  const { data: actividad } = await supabase
    .from('actividad')
    .select('*')
    .eq('drop_id', dropId)
    .order('created_at', { ascending: false })
    .limit(20);

  const service = await createServiceClient();
  const { count: anotadasCount } = await service
    .from('anotaciones')
    .select('*', { count: 'exact', head: true })
    .eq('drop_id', dropId);

  return (
    <DropPageClient
      tienda={tienda}
      drop={drop}
      prendas={prendas ?? []}
      metodosPago={metodosPago ?? []}
      metodosEnvio={metodosEnvio ?? []}
      actividad={actividad ?? []}
      anotadasCount={anotadasCount ?? 0}
    />
  );
}
