import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { BillingClient } from './billing-client';

export const dynamic = 'force-dynamic';

export default async function BillingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: tienda } = await supabase
    .from('tiendas')
    .select('plan, plan_status, plan_vence_at, paypal_plan_id')
    .eq('user_id', user.id)
    .single();

  if (!tienda) redirect('/onboarding');

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <BillingClient tienda={tienda} />
    </div>
  );
}
