import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { confirmarSuscripcion } from '../actions';

export const dynamic = 'force-dynamic';

export default async function BillingSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ subscription_id?: string; plan?: string }>;
}) {
  const { subscription_id } = await searchParams;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  if (subscription_id) {
    await confirmarSuscripcion(subscription_id);
  }

  return (
    <div style={{
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', padding: 24,
    }}>
      <div style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
        <div style={{
          width: 72, height: 72, borderRadius: 36,
          background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-3) 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28, margin: '0 auto 24px',
        }}>
          ⚡
        </div>
        <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.025em', marginBottom: 8 }}>
          ¡Bienvenida al Plan Pro!
        </div>
        <div style={{ fontSize: 15, color: 'var(--ink-3)', marginBottom: 32, lineHeight: 1.6 }}>
          Tu suscripción está activa. PayPal procesará los pagos automáticamente cada mes o año según tu plan.
        </div>
        <a
          href="/dashboard"
          style={{
            display: 'block', height: 52, lineHeight: '52px',
            background: 'var(--accent)', color: '#fff',
            borderRadius: 14, fontSize: 15, fontWeight: 700,
            textDecoration: 'none', textAlign: 'center',
          }}
        >
          Ir al dashboard
        </a>
      </div>
    </div>
  );
}
