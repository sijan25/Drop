import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import DashboardLayoutClient from './layout-client';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: tienda } = await supabase
    .from('tiendas')
    .select('id, nombre, username, plan, logo_url')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!tienda) redirect('/onboarding');

  return <DashboardLayoutClient tienda={tienda}>{children}</DashboardLayoutClient>;
}
