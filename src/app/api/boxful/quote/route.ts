import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { quoteBoxful } from '@/lib/boxful/client';
import { checkRequestRateLimit, requireTrustedRequestOrigin } from '@/lib/security/request';

const quoteSchema = z.object({
  mode: z.enum(['boxful_dropoff', 'boxful_recoleccion']),
  originCityName: z.string().trim().max(90).nullable().optional(),
  destinationStateId: z.string().trim().max(80).nullable().optional(),
  destinationStateName: z.string().trim().min(2).max(90),
  destinationCityId: z.string().trim().max(80).nullable().optional(),
  destinationCityName: z.string().trim().min(2).max(90),
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

  const quote = await quoteBoxful(parsed.data);
  return NextResponse.json({ quote });
}
