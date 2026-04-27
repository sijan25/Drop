'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { iniciarSuscripcion, cancelarSuscripcion } from './actions';
import { PAYPAL_PLANS, PLAN_FEATURES, type PlanKey } from '@/lib/paypal/plans';

type Tienda = {
  plan: string | null;
  plan_status: string | null;
  plan_vence_at: string | null;
  paypal_plan_id: string | null;
};

export function BillingClient({ tienda }: { tienda: Tienda }) {
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>('pro_monthly');
  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);

  const esPro = tienda.plan === 'pro';
  const esActivo = tienda.plan_status === 'active';
  const esCancelado = tienda.plan_status === 'cancelled';
  const venceAt = tienda.plan_vence_at ? new Date(tienda.plan_vence_at) : null;
  const planActualKey = Object.entries(PAYPAL_PLANS).find(
    ([, p]) => p.id === tienda.paypal_plan_id
  )?.[0] as PlanKey | undefined;

  async function handleSuscribir() {
    setError('');
    setLoading(true);
    const res = await iniciarSuscripcion(selectedPlan);
    if (res.error) { setError(res.error); setLoading(false); return; }
    if (res.approvalUrl) window.location.href = res.approvalUrl;
  }

  async function handleCancelar() {
    if (!confirmCancel) { setConfirmCancel(true); return; }
    setCancelling(true);
    setError('');
    const res = await cancelarSuscripcion();
    if (res.error) { setError(res.error); setCancelling(false); setConfirmCancel(false); return; }
    router.refresh();
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px' }}>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.025em', marginBottom: 4 }}>Suscripción</div>
        <div style={{ fontSize: 14, color: 'var(--ink-3)' }}>Administrá tu plan y facturación.</div>
      </div>

      {/* Current plan banner */}
      <div style={{
        padding: '20px 24px',
        borderRadius: 16,
        marginBottom: 32,
        background: esPro && esActivo
          ? 'linear-gradient(135deg, #1a170f 0%, #3a2a1a 100%)'
          : 'var(--surface-2)',
        color: esPro && esActivo ? '#fff' : 'var(--ink)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
      }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.6, marginBottom: 4 }}>
            Plan actual
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>
            {esPro ? 'Pro' : 'Starter'}{' '}
            {planActualKey && <span style={{ fontWeight: 400, fontSize: 14, opacity: 0.7 }}>({PAYPAL_PLANS[planActualKey].label})</span>}
          </div>
          {esPro && esActivo && venceAt && (
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
              Próxima renovación: {venceAt.toLocaleDateString('es-HN', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          )}
          {esPro && esCancelado && venceAt && (
            <div style={{ fontSize: 12, color: '#f87171', marginTop: 4 }}>
              Acceso hasta: {venceAt.toLocaleDateString('es-HN', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          )}
        </div>
        <div style={{
          padding: '6px 14px', borderRadius: 20,
          background: esPro && esActivo ? 'rgba(255,255,255,0.15)' : esCancelado ? '#fef2f2' : 'var(--line)',
          color: esCancelado ? '#dc2626' : esPro && esActivo ? '#fff' : 'var(--ink-3)',
          fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
        }}>
          {esActivo ? 'Activo' : esCancelado ? 'Cancelado' : 'Gratis'}
        </div>
      </div>

      {/* Features comparison */}
      {!esPro && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 32 }}>
          {(['starter', 'pro'] as const).map(tier => (
            <div key={tier} style={{
              padding: '18px 20px',
              border: `1.5px solid ${tier === 'pro' ? 'var(--accent)' : 'var(--line)'}`,
              borderRadius: 14,
              background: tier === 'pro' ? 'rgba(201,100,66,0.04)' : '#fff',
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'capitalize', marginBottom: 12 }}>
                {tier === 'pro' ? '⚡ Pro' : 'Starter (actual)'}
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
                {PLAN_FEATURES[tier].map((f, i) => (
                  <li key={i} style={{ fontSize: 12, color: 'var(--ink-2)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ color: tier === 'pro' ? 'var(--accent)' : 'var(--ink-3)', flexShrink: 0, marginTop: 1 }}>
                      {tier === 'pro' ? '✓' : '·'}
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* Upgrade section — only if not active pro */}
      {(!esPro || esCancelado) && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>
            {esCancelado ? 'Reactivar suscripción' : 'Elegí tu plan'}
          </div>

          {/* Plan toggles */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            {(Object.entries(PAYPAL_PLANS) as [PlanKey, typeof PAYPAL_PLANS[PlanKey]][]).map(([key, plan]) => (
              <button
                key={key}
                onClick={() => setSelectedPlan(key)}
                style={{
                  padding: '16px 18px', textAlign: 'left',
                  border: `2px solid ${selectedPlan === key ? 'var(--accent)' : 'var(--line)'}`,
                  borderRadius: 14, background: selectedPlan === key ? 'rgba(201,100,66,0.05)' : '#fff',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{plan.label}</div>
                <div className="mono tnum" style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 4 }}>
                  {plan.priceLabel}
                </div>
                {plan.annualEquiv && (
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 4 }}>{plan.annualEquiv}</div>
                )}
                {plan.savings && (
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', background: 'rgba(201,100,66,0.1)', padding: '2px 8px', borderRadius: 20, display: 'inline-block' }}>
                    {plan.savings}
                  </div>
                )}
              </button>
            ))}
          </div>

          {error && (
            <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, color: '#dc2626', marginBottom: 16 }}>
              {error}
            </div>
          )}

          <button
            className="btn btn-primary btn-block"
            style={{ height: 52, fontSize: 15, fontWeight: 700, borderRadius: 14 }}
            onClick={handleSuscribir}
            disabled={loading}
          >
            {loading ? 'Redirigiendo a PayPal...' : `Suscribirse con PayPal · ${PAYPAL_PLANS[selectedPlan].priceLabel}`}
          </button>

          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--ink-3)', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            Pago seguro vía PayPal · Podés cancelar cuando quieras
          </div>
        </div>
      )}

      {/* Cancel section — only if active */}
      {esPro && esActivo && (
        <div style={{ marginTop: 40, paddingTop: 24, borderTop: '1px solid var(--line)' }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Cancelar suscripción</div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 16, lineHeight: 1.55 }}>
            Si cancelás, mantenés acceso Pro hasta el{' '}
            {venceAt ? venceAt.toLocaleDateString('es-HN', { day: 'numeric', month: 'long', year: 'numeric' }) : 'fin del período'}
            . Después pasás a Starter automáticamente.
          </div>

          {error && (
            <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, color: '#dc2626', marginBottom: 12 }}>
              {error}
            </div>
          )}

          {confirmCancel ? (
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="btn"
                style={{ height: 42, fontSize: 13, flex: 1, border: '1.5px solid var(--urgent)', color: 'var(--urgent)', borderRadius: 10, background: '#fff' }}
                onClick={handleCancelar}
                disabled={cancelling}
              >
                {cancelling ? 'Cancelando...' : 'Sí, cancelar suscripción'}
              </button>
              <button
                className="btn btn-outline"
                style={{ height: 42, fontSize: 13, flex: 1, borderRadius: 10 }}
                onClick={() => setConfirmCancel(false)}
                disabled={cancelling}
              >
                No, mantener
              </button>
            </div>
          ) : (
            <button
              className="btn btn-outline"
              style={{ height: 42, fontSize: 13, borderRadius: 10, color: 'var(--ink-3)' }}
              onClick={() => setConfirmCancel(true)}
            >
              Cancelar suscripción
            </button>
          )}
        </div>
      )}
    </div>
  );
}
