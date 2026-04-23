'use server';

import type { createClient } from '@/lib/supabase/server';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type PedidoItemRow = {
  prenda_id: string;
  talla_seleccionada: string | null;
};

type PrendaStockRow = {
  id: string;
  cantidad: number | null;
  talla: string | null;
  tallas: string[] | null;
  cantidades_por_talla: Record<string, number> | null;
};

function getMatchedSize(prenda: PrendaStockRow, requested: string | null) {
  const cleaned = requested?.trim();
  if (!cleaned) return null;
  return prenda.tallas?.find(size => size.toLowerCase() === cleaned.toLowerCase())
    ?? (prenda.talla && prenda.talla.toLowerCase() === cleaned.toLowerCase() ? prenda.talla : null);
}

export async function restaurarInventarioPedido(
  db: SupabaseServerClient,
  pedidoId: string,
  tiendaId: string,
) {
  const { data: pedidoItems } = await db
    .from('pedido_items')
    .select('prenda_id, talla_seleccionada')
    .eq('pedido_id', pedidoId);

  const items = (pedidoItems ?? []) as PedidoItemRow[];
  if (items.length === 0) return;

  const increments = new Map<string, { total: number; bySize: Record<string, number> }>();
  for (const item of items) {
    const current = increments.get(item.prenda_id) ?? { total: 0, bySize: {} };
    current.total += 1;
    if (item.talla_seleccionada) {
      current.bySize[item.talla_seleccionada] = (current.bySize[item.talla_seleccionada] ?? 0) + 1;
    }
    increments.set(item.prenda_id, current);
  }

  const { data: prendas } = await db
    .from('prendas')
    .select('id, cantidad, talla, tallas, cantidades_por_talla')
    .eq('tienda_id', tiendaId)
    .in('id', Array.from(increments.keys()));

  for (const prenda of (prendas ?? []) as PrendaStockRow[]) {
    const increment = increments.get(prenda.id);
    if (!increment) continue;

    const nextMap: Record<string, number> = { ...(prenda.cantidades_por_talla ?? {}) };
    for (const [requestedSize, qty] of Object.entries(increment.bySize)) {
      const matched = getMatchedSize(prenda, requestedSize);
      if (!matched) continue;
      nextMap[matched] = Math.max(0, Number(nextMap[matched] ?? 0)) + qty;
    }

    await db
      .from('prendas')
      .update({
        cantidad: Math.max(0, Number(prenda.cantidad ?? 0)) + increment.total,
        cantidades_por_talla: (prenda.tallas?.length ?? 0) > 0 ? nextMap : {},
        estado: 'disponible',
      })
      .eq('id', prenda.id)
      .eq('tienda_id', tiendaId);
  }
}
