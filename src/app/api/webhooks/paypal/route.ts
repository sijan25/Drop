import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { verifyWebhookSignature, getSubscription } from '@/lib/paypal/client';
import { PAYPAL_PLANS } from '@/lib/paypal/plans';

type PayPalEvent = {
  event_type: string;
  resource: {
    id: string;
    status?: string;
    plan_id?: string;
    billing_agreement_id?: string;
    billing_info?: { next_billing_time?: string };
  };
};

function calcVenceAt(planId: string, fallbackDays = 35): string {
  const isAnnual = planId === PAYPAL_PLANS.pro_annual.id;
  const days = isAnnual ? 366 : fallbackDays;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  const valid = await verifyWebhookSignature(req.headers, rawBody);
  if (!valid && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let event: PayPalEvent;
  try {
    event = JSON.parse(rawBody) as PayPalEvent;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const service = await createServiceClient();
  const { event_type, resource } = event;

  // ── BILLING.SUBSCRIPTION.ACTIVATED ──
  if (event_type === 'BILLING.SUBSCRIPTION.ACTIVATED') {
    const subId = resource.id;
    let venceAt: string;

    try {
      const sub = await getSubscription(subId);
      venceAt = sub.billing_info?.next_billing_time ?? calcVenceAt(sub.plan_id);
    } catch {
      venceAt = calcVenceAt(resource.plan_id ?? '');
    }

    await service.from('tiendas').update({
      plan: 'pro',
      plan_status: 'active',
      plan_vence_at: venceAt,
    }).eq('paypal_sub_id', subId);
  }

  // ── PAYMENT.SALE.COMPLETED (recurring payment) ──
  else if (event_type === 'PAYMENT.SALE.COMPLETED') {
    const subId = resource.billing_agreement_id;
    if (!subId) return NextResponse.json({ ok: true });

    try {
      const sub = await getSubscription(subId);
      const venceAt = sub.billing_info?.next_billing_time ?? calcVenceAt(sub.plan_id);

      await service.from('tiendas').update({
        plan: 'pro',
        plan_status: 'active',
        plan_vence_at: venceAt,
      }).eq('paypal_sub_id', subId);
    } catch {
      // Non-fatal: subscription may have been found already by ACTIVATED event
    }
  }

  // ── BILLING.SUBSCRIPTION.CANCELLED ──
  else if (event_type === 'BILLING.SUBSCRIPTION.CANCELLED') {
    // Keep plan='pro' until plan_vence_at; just mark as cancelled
    await service.from('tiendas').update({
      plan_status: 'cancelled',
    }).eq('paypal_sub_id', resource.id);
  }

  // ── BILLING.SUBSCRIPTION.SUSPENDED ──
  else if (event_type === 'BILLING.SUBSCRIPTION.SUSPENDED') {
    await service.from('tiendas').update({
      plan_status: 'past_due',
    }).eq('paypal_sub_id', resource.id);
  }

  // ── BILLING.SUBSCRIPTION.EXPIRED ──
  else if (event_type === 'BILLING.SUBSCRIPTION.EXPIRED') {
    await service.from('tiendas').update({
      plan: 'starter',
      plan_status: 'expired',
      plan_vence_at: null,
    }).eq('paypal_sub_id', resource.id);
  }

  // ── PAYMENT.SALE.REFUNDED / PAYMENT.SALE.REVERSED ──
  else if (
    event_type === 'PAYMENT.SALE.REFUNDED' ||
    event_type === 'PAYMENT.SALE.REVERSED'
  ) {
    const subId = resource.billing_agreement_id;
    if (subId) {
      await service.from('tiendas').update({
        plan: 'starter',
        plan_status: 'expired',
        plan_vence_at: null,
      }).eq('paypal_sub_id', subId);
    }
  }

  return NextResponse.json({ ok: true });
}
