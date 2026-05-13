import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/server';
import type { Json } from '@/types/database';

export const runtime = 'nodejs';

type BoxfulWebhookPayload = {
  shipmentId?: string;
  shipmentNumber?: string;
  orderNumber?: string;
  storeOrderNumber?: string;
  status?: string | number;
  statusDescription?: string;
  date?: string;
  accessToken?: string;
  token?: string;
  [key: string]: unknown;
};

type PedidoWebhookRow = {
  id: string;
  numero: string;
  estado: string | null;
  envio_metadata: Json;
  tracking_numero: string | null;
  en_camino_at: string | null;
  entregado_at: string | null;
};

function normalizeText(value: string | null | undefined) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function getWebhookToken(request: NextRequest) {
  const auth = request.headers.get('authorization')?.trim();
  if (auth?.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();

  return (
    request.headers.get('x-boxful-token') ??
    request.headers.get('x-boxful-access-token') ??
    request.headers.get('x-webhook-token') ??
    ''
  ).trim();
}

function isValidEventDate(value: string | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function resolveMainOrderStatus(payload: BoxfulWebhookPayload, currentStatus: string | null) {
  const status = String(payload.status ?? '').trim();
  const description = normalizeText(payload.statusDescription);
  const lockedStatuses = new Set(['entregado', 'cancelado']);

  if (lockedStatuses.has(currentStatus ?? '')) return null;
  if (status === '4' || description === 'entregado') return 'entregado';
  if (status === '2' || status === '3' || description === 'recolectado' || description === 'en ruta a destino') {
    return currentStatus === 'en_camino' ? null : 'en_camino';
  }

  return null;
}

function asRecord(value: Json): Record<string, Json> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, Json>;
}

function buildNextMetadata(previous: Json, payload: BoxfulWebhookPayload, receivedAt: string): Json {
  const current = asRecord(previous);
  const currentEvents = Array.isArray(current.boxful_events) ? current.boxful_events : [];
  const event: Json = {
    shipmentId: payload.shipmentId ?? null,
    shipmentNumber: payload.shipmentNumber ?? null,
    orderNumber: payload.orderNumber ?? null,
    storeOrderNumber: payload.storeOrderNumber ?? null,
    status: payload.status != null ? String(payload.status) : null,
    statusDescription: payload.statusDescription ?? null,
    date: payload.date ?? null,
    receivedAt,
  };

  return {
    ...current,
    boxful_last_event: event,
    boxful_events: [...currentEvents, event].slice(-20),
  };
}

async function findPedido(payload: BoxfulWebhookPayload): Promise<PedidoWebhookRow | null> {
  const service = await createServiceClient();
  const shipmentNumber = payload.shipmentNumber?.trim();
  const orderNumber = payload.orderNumber?.trim();
  const storeOrderNumber = payload.storeOrderNumber?.trim();
  const select = 'id, numero, estado, envio_metadata, tracking_numero, en_camino_at, entregado_at';

  if (shipmentNumber) {
    const { data } = await service
      .from('pedidos')
      .select(select)
      .eq('tracking_numero', shipmentNumber)
      .maybeSingle();
    if (data) return data;
  }

  for (const numero of [orderNumber, storeOrderNumber]) {
    if (!numero) continue;
    const { data } = await service
      .from('pedidos')
      .select(select)
      .eq('numero', numero)
      .maybeSingle();
    if (data) return data;
  }

  return null;
}

export async function POST(request: NextRequest) {
  let payload: BoxfulWebhookPayload;

  try {
    payload = await request.json() as BoxfulWebhookPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const configuredToken = process.env.BOXFUL_WEBHOOK_TOKEN?.trim();
  if (configuredToken && getWebhookToken(request) !== configuredToken) {
    return NextResponse.json({ error: 'Invalid webhook token' }, { status: 401 });
  }

  if (!payload.shipmentNumber && !payload.orderNumber && !payload.storeOrderNumber) {
    return NextResponse.json({ received: true, ignored: 'missing_order_reference' });
  }

  const pedido = await findPedido(payload);
  if (!pedido) {
    return NextResponse.json({ received: true, ignored: 'pedido_not_found' });
  }

  const service = await createServiceClient();
  const receivedAt = new Date().toISOString();
  const eventAt = isValidEventDate(payload.date) ?? receivedAt;
  const nextEstado = resolveMainOrderStatus(payload, pedido.estado);
  const update: Record<string, unknown> = {
    envio_estado: payload.statusDescription ?? String(payload.status ?? ''),
    envio_metadata: buildNextMetadata(pedido.envio_metadata, payload, receivedAt),
  };

  if (payload.shipmentNumber && !pedido.tracking_numero) {
    update.tracking_numero = payload.shipmentNumber;
  }

  if (nextEstado) {
    update.estado = nextEstado;
    if (nextEstado === 'en_camino' && !pedido.en_camino_at) update.en_camino_at = eventAt;
    if (nextEstado === 'entregado' && !pedido.entregado_at) update.entregado_at = eventAt;
  }

  const { error } = await service
    .from('pedidos')
    .update(update)
    .eq('id', pedido.id);

  if (error) {
    console.error('[boxful:webhook] update failed:', error);
    return NextResponse.json({ error: 'Could not update order' }, { status: 500 });
  }

  revalidatePath('/pedidos');
  revalidatePath(`/pedido/${pedido.numero}`);

  return NextResponse.json({
    received: true,
    pedido: pedido.numero,
    estado: nextEstado ?? pedido.estado,
    envioEstado: update.envio_estado,
  });
}
