import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { quoteBoxfulOptions } from '@/lib/boxful/client';
import { checkRequestRateLimit, requireTrustedRequestOrigin } from '@/lib/security/request';
import { createServiceClient } from '@/lib/supabase/server';

const quoteSchema = z.object({
  tiendaId: z.string().uuid(),
  prendaId: z.string().uuid().optional(),
  mode: z.enum(['boxful_dropoff', 'boxful_recoleccion']),
  originCityName: z.string().trim().max(90).nullable().optional(),
  destinationStateId: z.string().trim().max(80).nullable().optional(),
  destinationStateName: z.string().trim().min(2).max(90),
  destinationCityId: z.string().trim().max(80).nullable().optional(),
  destinationCityName: z.string().trim().min(2).max(90),
  preferredCourierId: z.string().trim().max(80).nullable().optional(),
  itemsCount: z.number().int().min(1).max(20),
  subtotal: z.number().min(0).max(1_000_000),
});

export async function POST(request: NextRequest) {
  const originError = requireTrustedRequestOrigin(request);
  if (originError) return NextResponse.json({ error: originError }, { status: 403 });

  const rateError = await checkRequestRateLimit(request, 'boxful:quote', 40, 10 * 60);
  if (rateError) return NextResponse.json({ error: rateError }, { status: 429 });

  const parsed = quoteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos de envío incompletos.' }, { status: 400 });
  }

  const service = await createServiceClient();

  // Validate tiendaId against a prenda to prevent using another store's Boxful quota
  if (parsed.data.prendaId) {
    const { data: prenda } = await service
      .from('prendas')
      .select('tienda_id')
      .eq('id', parsed.data.prendaId)
      .maybeSingle();
    if (!prenda || prenda.tienda_id !== parsed.data.tiendaId) {
      return NextResponse.json({ error: 'Tienda inválida.' }, { status: 403 });
    }
  }

  const { data: tienda } = await service
    .from('tiendas')
    .select('boxful_email, boxful_password, boxful_enabled')
    .eq('id', parsed.data.tiendaId)
    .maybeSingle();
  const boxfulCreds = tienda?.boxful_enabled && tienda.boxful_email && tienda.boxful_password
    ? { email: tienda.boxful_email, password: tienda.boxful_password }
    : null;

  let quotes;
  try {
    quotes = await quoteBoxfulOptions(parsed.data, boxfulCreds);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No pudimos obtener couriers de Boxful.';
    return NextResponse.json({ error: message, quote: null, quotes: [] }, { status: 502 });
  }

  const quote = parsed.data.preferredCourierId
    ? quotes.find(item => item.courierId === parsed.data.preferredCourierId) ?? quotes[0]
    : quotes[0];

  return NextResponse.json({ quote, quotes });
}
