'use server';

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { guardServerMutation } from '@/lib/security/request';
import { createSubscription, cancelSubscription, getSubscription } from '@/lib/paypal/client';
import { PAYPAL_PLANS, type PlanKey } from '@/lib/paypal/plans';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

async function getTienda() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('tiendas')
    .select('id, nombre, contact_email, plan, plan_status, plan_vence_at, paypal_sub_id, paypal_plan_id')
    .eq('user_id', user.id)
    .single();

  return data ?? null;
}

export async function iniciarSuscripcion(planKey: PlanKey): Promise<{ approvalUrl?: string; error?: string }> {
  const guardError = await guardServerMutation('billing:subscribe', 10, 60 * 60);
  if (guardError) return { error: guardError };

  const tienda = await getTienda();
  if (!tienda) return { error: 'No autorizado.' };

  const plan = PAYPAL_PLANS[planKey];
  if (!plan.id) return { error: 'Plan no configurado. Contactá soporte.' };

  if (tienda.plan_status === 'active') return { error: 'Ya tenés una suscripción activa.' };

  try {
    const sub = await createSubscription(
      plan.id,
      `${APP_URL}/billing/success?plan=${planKey}`,
      `${APP_URL}/billing?cancelled=1`,
      tienda.nombre,
      tienda.contact_email ?? '',
    );

    const approvalUrl = sub.links.find(l => l.rel === 'approve')?.href;
    if (!approvalUrl) return { error: 'No pudimos iniciar el pago con PayPal. Intentá de nuevo.' };

    // Save pending subscription ID so webhook can match it
    const service = await createServiceClient();
    await service
      .from('tiendas')
      .update({ paypal_sub_id: sub.id, paypal_plan_id: plan.id })
      .eq('id', tienda.id);

    return { approvalUrl };
  } catch (e) {
    console.error('[billing] iniciarSuscripcion:', e);
    return { error: 'Error al conectar con PayPal. Intentá más tarde.' };
  }
}

export async function cancelarSuscripcion(): Promise<{ ok?: boolean; error?: string }> {
  const guardError = await guardServerMutation('billing:cancel', 5, 60 * 60);
  if (guardError) return { error: guardError };

  const tienda = await getTienda();
  if (!tienda) return { error: 'No autorizado.' };
  if (!tienda.paypal_sub_id) return { error: 'No hay suscripción activa.' };
  if (tienda.plan_status !== 'active') return { error: 'La suscripción ya no está activa.' };

  try {
    await cancelSubscription(tienda.paypal_sub_id, 'Cancelación solicitada por el usuario.');
  } catch (e) {
    console.error('[billing] cancelarSuscripcion:', e);
    return { error: 'No pudimos cancelar en PayPal. Intentá de nuevo o contactá soporte.' };
  }

  const service = await createServiceClient();
  await service
    .from('tiendas')
    .update({ plan_status: 'cancelled' })
    .eq('id', tienda.id);

  return { ok: true };
}

export async function confirmarSuscripcion(subscriptionId: string): Promise<{ ok?: boolean; error?: string }> {
  const tienda = await getTienda();
  if (!tienda) return { error: 'No autorizado.' };

  try {
    const sub = await getSubscription(subscriptionId);
    if (sub.status !== 'ACTIVE') return { ok: true }; // webhook will handle it

    const service = await createServiceClient();
    const nextBilling = sub.billing_info?.next_billing_time;
    const venceAt = nextBilling ?? calcularVenceAt(sub.plan_id);

    await service.from('tiendas').update({
      plan: 'pro',
      plan_status: 'active',
      plan_vence_at: venceAt,
      paypal_sub_id: sub.id,
      paypal_plan_id: sub.plan_id,
    }).eq('id', tienda.id);

    return { ok: true };
  } catch {
    return { ok: true }; // webhook is source of truth
  }
}

export async function obtenerSuscripcion() {
  const tienda = await getTienda();
  return tienda;
}

function calcularVenceAt(planId: string): string {
  const isAnnual = planId === PAYPAL_PLANS.pro_annual.id;
  const days = isAnnual ? 366 : 35;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}
