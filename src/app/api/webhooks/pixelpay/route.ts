import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import Settings from '@pixelpay/sdk-core/lib/models/Settings';
import Transaction from '@pixelpay/sdk-core/lib/services/Transaction';
import { decryptPixelPaySecret, getSandboxPixelPayCredentials } from '@/lib/pixelpay/security';

type PixelPayCallbackPayload = {
  order_id?: string;
  payment_uuid?: string;
  payment_hash?: string;
  transaction_id?: string;
  transaction_approved?: boolean;
  response_code?: string;
  response_reason?: string;
  [key: string]: unknown;
};

export async function POST(request: NextRequest) {
  let payload: PixelPayCallbackPayload;

  try {
    payload = await request.json() as PixelPayCallbackPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const { order_id, payment_uuid, payment_hash, transaction_id, transaction_approved } = payload;

  if (!order_id || !payment_uuid || !transaction_approved || !payment_hash) {
    return NextResponse.json({ received: true });
  }

  const service = await createServiceClient();

  const { data: pedido } = await service
    .from('pedidos')
    .select('id, estado, tienda_id')
    .eq('numero', order_id)
    .maybeSingle();

  if (!pedido) return NextResponse.json({ received: true });
  if (pedido.estado === 'pagado' || pedido.estado === 'cancelado') {
    return NextResponse.json({ received: true });
  }

  const { data: tienda } = await service
    .from('tiendas')
    .select('pixelpay_endpoint, pixelpay_key_id, pixelpay_secret_key, pixelpay_sandbox')
    .eq('id', pedido.tienda_id)
    .maybeSingle();

  const isSandbox = (tienda as { pixelpay_sandbox?: boolean } | null)?.pixelpay_sandbox ?? true;
  const sandbox = getSandboxPixelPayCredentials();
  const rawSecret = isSandbox
    ? sandbox.secret
    : decryptPixelPaySecret((tienda as { pixelpay_secret_key?: string } | null)?.pixelpay_secret_key);
  const keyId = isSandbox
    ? sandbox.keyId
    : (tienda as { pixelpay_key_id?: string } | null)?.pixelpay_key_id?.trim();
  const endpoint = (tienda as { pixelpay_endpoint?: string } | null)?.pixelpay_endpoint?.trim();

  if (!rawSecret || !keyId) {
    return NextResponse.json({ received: true });
  }

  const settings = new Settings();
  if (isSandbox) {
    settings.setupSandbox();
  } else {
    if (!endpoint) return NextResponse.json({ received: true });
    settings.setupEndpoint(endpoint);
    settings.setupCredentials(keyId, rawSecret);
  }

  const txService = new Transaction(settings);
  const isValid = txService.verifyPaymentHash(payment_hash, order_id, rawSecret);
  if (!isValid) {
    return NextResponse.json({ received: true }, { status: 400 });
  }

  await service.from('pedidos').update({
    estado: 'pagado',
    comprobante_estado: 'verificado',
    pagado_at: new Date().toISOString(),
    pixelpay_payment_uuid: payment_uuid,
    pixelpay_payment_hash: payment_hash ?? null,
    pixelpay_transaction_id: transaction_id ?? null,
    pixelpay_response: payload as Record<string, unknown>,
  } as Record<string, unknown>).eq('id', pedido.id);

  await service.from('payment_attempts').update({
    status: 'synced',
    payment_uuid,
    transaction_id: transaction_id ?? null,
    response_payload: payload as Record<string, unknown>,
    error_message: null,
  } as Record<string, unknown>)
    .eq('pedido_id', pedido.id)
    .eq('provider', 'pixelpay')
    .in('status', ['approved', 'sync_pending', 'processing']);

  return NextResponse.json({ received: true });
}
