import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ConfiguracionClient } from './configuracion-client';

export default async function ConfiguracionPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: tienda } = await supabase
    .from('tiendas')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (!tienda) redirect('/onboarding');

  const { data: metodosPago } = await supabase
    .from('metodos_pago')
    .select('*')
    .eq('tienda_id', tienda.id)
    .order('created_at', { ascending: true });

  const { data: metodosEnvio } = await supabase
    .from('metodos_envio')
    .select('*')
    .eq('tienda_id', tienda.id)
    .order('created_at', { ascending: true });

  const { data: opcionesCatalogo } = await supabase
    .from('opciones_catalogo')
    .select('*')
    .eq('tienda_id', tienda.id)
    .order('tipo', { ascending: true })
    .order('orden', { ascending: true })
    .order('nombre', { ascending: true });

  return (
    <ConfiguracionClient
      tienda={tienda}
      ownerEmail={user.email ?? ''}
      metodosPago={metodosPago ?? []}
      metodosEnvio={metodosEnvio ?? []}
      opcionesCatalogo={opcionesCatalogo ?? []}
    />
  );
}
