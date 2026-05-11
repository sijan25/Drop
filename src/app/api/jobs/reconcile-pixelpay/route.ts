import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PaymentAttemptRow = {
  id: string;
  pedido_id: string;
  order_id: string;
  payment_uuid: string | null;
  transaction_id: string | null;
  response_payload: Record<string, unknown> | null;
};

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

async function syncAttempt(service: Awaited<ReturnType<typeof createServiceClient>>, attempt: PaymentAttemptRow) {
  if (!attempt.payment_uuid) return { id: attempt.id, status: 'skipped_no_payment_uuid' };

  const { data: pedido, error: pedidoError } = await service
    .from('pedidos')
    .select('id, estado')
    .eq('id', attempt.pedido_id)
    .maybeSingle();

  if (pedidoError) throw pedidoError;
  if (!pedido) return { id: attempt.id, status: 'skipped_missing_order' };

  if ((pedido as { estado?: string | null }).estado === 'pagado') {
    await service.from('payment_attempts').update({ status: 'synced' } as Record<string, unknown>).eq('id', attempt.id);
    return { id: attempt.id, status: 'already_paid' };
  }

  const { error: updateOrderError } = await service.from('pedidos').update({
    estado: 'pagado',
    comprobante_estado: 'verificado',
    pagado_at: new Date().toISOString(),
    pixelpay_order_id: attempt.order_id,
    pixelpay_payment_uuid: attempt.payment_uuid,
    pixelpay_transaction_id: attempt.transaction_id,
    pixelpay_response: attempt.response_payload ?? {},
  } as Record<string, unknown>).eq('id', attempt.pedido_id);

  if (updateOrderError) throw updateOrderError;

  const { error: updateAttemptError } = await service.from('payment_attempts').update({
    status: 'synced',
    error_message: null,
  } as Record<string, unknown>).eq('id', attempt.id);

  if (updateAttemptError) throw updateAttemptError;
  return { id: attempt.id, status: 'synced' };
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const service = await createServiceClient();
  const { data, error } = await service
    .from('payment_attempts')
    .select('id, pedido_id, order_id, payment_uuid, transaction_id, response_payload')
    .eq('provider', 'pixelpay')
    .in('status', ['approved', 'sync_pending'])
    .not('payment_uuid', 'is', null)
    .order('created_at', { ascending: true })
    .limit(25);

  if (error) {
    console.error('[reconcile-pixelpay] Error leyendo intentos:', error);
    return NextResponse.json({ error: 'Unable to read payment attempts' }, { status: 500 });
  }

  const attempts = (data ?? []) as PaymentAttemptRow[];
  const results = [];

  for (const attempt of attempts) {
    try {
      results.push(await syncAttempt(service, attempt));
    } catch (error) {
      console.error('[reconcile-pixelpay] Error sincronizando intento:', attempt.id, error);
      await service.from('payment_attempts').update({
        status: 'sync_pending',
        error_message: error instanceof Error ? error.message : 'Unknown reconciliation error',
      } as Record<string, unknown>).eq('id', attempt.id);
      results.push({ id: attempt.id, status: 'error' });
    }
  }

  return NextResponse.json({ checked: attempts.length, results });
}
