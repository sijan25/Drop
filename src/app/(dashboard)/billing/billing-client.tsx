'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { iniciarSuscripcion, cancelarSuscripcion } from './actions';
import { PAYPAL_PLANS, type PlanKey } from '@/lib/paypal/plans';
import { Icons } from '@/components/shared/icons';
import { cn } from '@/lib/utils';

type Tienda = {
  plan: string | null;
  plan_status: string | null;
  plan_vence_at: string | null;
  paypal_plan_id: string | null;
};

type FeatureItem = {
  icon: keyof typeof Icons;
  text: string;
};

const STARTER_FEATURES: FeatureItem[] = [
  { icon: 'box',  text: 'Hasta 50 prendas en inventario' },
  { icon: 'sparkle', text: '1 drop activo a la vez' },
  { icon: 'bag',  text: 'Carrito de compras' },
  { icon: 'mail', text: 'Notificaciones por email' },
];

const PRO_FEATURES: FeatureItem[] = [
  { icon: 'box',      text: 'Prendas ilimitadas' },
  { icon: 'sparkle',  text: 'Drops ilimitados simultáneos' },
  { icon: 'bag',      text: 'Carrito de compras' },
  { icon: 'whatsapp', text: 'Notificaciones por email y WhatsApp' },
  { icon: 'chart',    text: 'Analytics de ventas' },
  { icon: 'user',     text: 'Soporte prioritario' },
];

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

  const fechaFormateada = venceAt?.toLocaleDateString('es-HN', { day: 'numeric', month: 'long', year: 'numeric' });

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
    <div className="max-w-[720px] mx-auto px-4 sm:px-6 py-8">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-[24px] font-extrabold tracking-[-0.025em] mb-[3px]">Suscripción</h1>
        <p className="text-[14px] text-[var(--ink-3)]">Administrá tu plan y facturación.</p>
      </div>

      {/* Plan actual */}
      <div className={cn(
        'rounded-[18px] px-5 py-5 mb-8 flex items-center justify-between gap-4',
        esPro && esActivo
          ? 'bg-[var(--ink)] text-white'
          : 'bg-[var(--surface-2)] text-[var(--ink)]'
      )}>
        <div>
          <div className={cn(
            'text-[10px] font-bold uppercase tracking-[0.1em] mb-[5px]',
            esPro && esActivo ? 'text-white/50' : 'text-[var(--ink-3)]'
          )}>
            Plan actual
          </div>
          <div className="flex items-center gap-[10px]">
            <span className="text-[22px] font-extrabold tracking-[-0.02em]">
              {esPro ? 'Pro' : 'Starter'}
            </span>
            {planActualKey && (
              <span className={cn(
                'text-[12px] font-normal',
                esPro && esActivo ? 'text-white/60' : 'text-[var(--ink-3)]'
              )}>
                {PAYPAL_PLANS[planActualKey].label}
              </span>
            )}
          </div>
          {esPro && esActivo && fechaFormateada && (
            <div className="text-[12px] text-white/60 mt-[4px]">
              Próxima renovación: {fechaFormateada}
            </div>
          )}
          {esPro && esCancelado && fechaFormateada && (
            <div className="text-[12px] text-red-400 mt-[4px]">
              Acceso hasta: {fechaFormateada}
            </div>
          )}
        </div>
        <div className={cn(
          'px-[14px] py-[6px] rounded-[20px] text-[11px] font-bold whitespace-nowrap shrink-0',
          esPro && esActivo
            ? 'bg-white/15 text-white'
            : esCancelado
              ? 'bg-red-50 text-red-600'
              : 'bg-[var(--line)] text-[var(--ink-3)]'
        )}>
          {esActivo ? 'Activo' : esCancelado ? 'Cancelado' : 'Gratis'}
        </div>
      </div>

      {/* Comparación de planes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
        {/* Starter */}
        <div className="rounded-[16px] border border-[var(--line)] bg-white p-5">
          <div className="flex items-center gap-[8px] mb-4">
            <div className="w-[32px] h-[32px] rounded-[8px] bg-[var(--surface-2)] flex items-center justify-center">
              <Icons.box width={15} height={15} className="text-[var(--ink-2)]" />
            </div>
            <div>
              <div className="text-[13px] font-bold">Starter</div>
              <div className="text-[11px] text-[var(--ink-3)]">Gratis</div>
            </div>
          </div>
          <ul className="grid gap-[10px]">
            {STARTER_FEATURES.map((f, i) => {
              const Icon = Icons[f.icon];
              return (
                <li key={i} className="flex items-start gap-[8px] text-[12px] text-[var(--ink-2)]">
                  <Icon width={13} height={13} className="text-[var(--ink-3)] shrink-0 mt-[1px]" />
                  {f.text}
                </li>
              );
            })}
          </ul>
        </div>

        {/* Pro */}
        <div className="rounded-[16px] border-[1.5px] border-[var(--accent)] bg-[rgba(201,100,66,0.03)] p-5">
          <div className="flex items-center gap-[8px] mb-4">
            <div className="w-[32px] h-[32px] rounded-[8px] bg-[rgba(201,100,66,0.12)] flex items-center justify-center">
              <Icons.sparkle width={15} height={15} className="text-[var(--accent)]" />
            </div>
            <div>
              <div className="text-[13px] font-bold">Pro</div>
              <div className="text-[11px] text-[var(--accent)]">
                {selectedPlan === 'pro_annual'
                  ? `L ${(PAYPAL_PLANS.pro_annual.price / 12).toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mes`
                  : `L ${PAYPAL_PLANS.pro_monthly.price.toLocaleString('es-HN')}/mes`}
              </div>
            </div>
          </div>
          <ul className="grid gap-[10px]">
            {PRO_FEATURES.map((f, i) => {
              const Icon = Icons[f.icon];
              return (
                <li key={i} className="flex items-start gap-[8px] text-[12px] text-[var(--ink-2)]">
                  <Icon width={13} height={13} className="text-[var(--accent)] shrink-0 mt-[1px]" />
                  {f.text}
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* Sección de upgrade */}
      {(!esPro || esCancelado) && (
        <div>
          <div className="text-[15px] font-bold mb-4">
            {esCancelado ? 'Reactivar suscripción' : 'Elegí tu plan'}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
            {(Object.entries(PAYPAL_PLANS) as [PlanKey, typeof PAYPAL_PLANS[PlanKey]][]).map(([key, plan]) => (
              <button
                key={key}
                onClick={() => setSelectedPlan(key)}
                className={cn(
                  'text-left rounded-[14px] border-[2px] p-4 cursor-pointer transition-colors',
                  selectedPlan === key
                    ? 'border-[var(--accent)] bg-[rgba(201,100,66,0.04)]'
                    : 'border-[var(--line)] bg-white hover:border-[var(--ink-3)]'
                )}
              >
                <div className="text-[13px] font-bold mb-[6px]">{plan.label}</div>
                <div className="mono tnum text-[22px] font-extrabold tracking-[-0.02em] mb-[4px]">
                  {plan.priceLabel}
                </div>
                {plan.annualEquiv && (
                  <div className="text-[11px] text-[var(--ink-3)] mb-[6px]">{plan.annualEquiv}</div>
                )}
                {plan.savings && (
                  <span className="text-[11px] font-bold text-[var(--accent)] bg-[rgba(201,100,66,0.1)] px-[8px] py-[2px] rounded-[20px]">
                    {plan.savings}
                  </span>
                )}
              </button>
            ))}
          </div>

          {error && (
            <div className="px-[14px] py-[10px] bg-red-50 border border-red-200 rounded-[8px] text-[13px] text-red-600 mb-4">
              {error}
            </div>
          )}

          <button
            className="btn btn-primary btn-block h-[52px] text-[15px] font-bold rounded-[14px]"
            onClick={handleSuscribir}
            disabled={loading}
          >
            {loading ? 'Redirigiendo a PayPal...' : `Suscribirse con PayPal · ${PAYPAL_PLANS[selectedPlan].priceLabel}`}
          </button>

          <div className="mt-[10px] flex items-center justify-center gap-[6px] text-[12px] text-[var(--ink-3)]">
            <Icons.card width={13} height={13} />
            Pago seguro vía PayPal · Podés cancelar cuando quieras
          </div>
        </div>
      )}

      {/* Cancelar suscripción */}
      {esPro && esActivo && (
        <div className="mt-10 pt-6 border-t border-[var(--line)]">
          <div className="text-[14px] font-semibold mb-[4px]">Cancelar suscripción</div>
          <div className="text-[13px] text-[var(--ink-3)] mb-5 leading-[1.55]">
            Si cancelás, mantenés acceso Pro hasta el{' '}
            <span className="font-medium text-[var(--ink)]">{fechaFormateada ?? 'fin del período'}</span>.
            Después pasás a Starter automáticamente.
          </div>

          {error && (
            <div className="px-[14px] py-[10px] bg-red-50 border border-red-200 rounded-[8px] text-[13px] text-red-600 mb-4">
              {error}
            </div>
          )}

          {confirmCancel ? (
            <div className="flex gap-[10px]">
              <button
                className="flex-1 h-[42px] text-[13px] rounded-[10px] border border-[var(--urgent)] text-[var(--urgent)] bg-white cursor-pointer font-medium"
                onClick={handleCancelar}
                disabled={cancelling}
              >
                {cancelling ? 'Cancelando...' : 'Sí, cancelar suscripción'}
              </button>
              <button
                className="btn btn-outline flex-1 h-[42px] text-[13px] rounded-[10px]"
                onClick={() => setConfirmCancel(false)}
                disabled={cancelling}
              >
                No, mantener
              </button>
            </div>
          ) : (
            <button
              className="btn btn-outline h-[42px] text-[13px] rounded-[10px] text-[var(--ink-3)]"
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
