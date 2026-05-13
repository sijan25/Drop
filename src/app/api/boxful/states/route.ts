import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getBoxfulStates } from '@/lib/boxful/client';
import { createServiceClient } from '@/lib/supabase/server';

const querySchema = z.object({
  tiendaId: z.string().uuid().optional(),
  prendaId: z.string().uuid().optional(),
});

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse({
    tiendaId: request.nextUrl.searchParams.get('tiendaId') ?? undefined,
    prendaId: request.nextUrl.searchParams.get('prendaId') ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: 'Parámetros inválidos.' }, { status: 400 });
  }

  let boxfulCreds: { email: string; password: string } | null = null;

  if (parsed.data.tiendaId) {
    const service = await createServiceClient();

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

    boxfulCreds = tienda?.boxful_enabled && tienda.boxful_email && tienda.boxful_password
      ? { email: tienda.boxful_email, password: tienda.boxful_password }
      : null;
  }

  try {
    const result = await getBoxfulStates(boxfulCreds);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No pudimos cargar ciudades de Boxful.';
    return NextResponse.json({ error: message, states: [] }, { status: 502 });
  }
}
