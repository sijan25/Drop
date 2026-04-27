import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getPublicTiendaOrRedirect } from '@/lib/stores/public-store';
import type { Database } from '@/types/database';
import { TiendaPageClient } from './tienda-page-client';

export const dynamic = 'force-dynamic';

export default async function TiendaPage({ params }: { params: Promise<{ tienda: string }> }) {
  const { tienda: username } = await params;
  const supabase = await createClient();
  const tienda = await getPublicTiendaOrRedirect(username);

  const { data: { user: sellerUser } } = await supabase.auth.getUser();
  const isOwnerPreview = sellerUser?.id === tienda.user_id;

  const { data: drops } = await supabase
    .from('drops')
    .select('id, nombre, descripcion, estado, inicia_at, cierra_at, duracion_minutos, foto_portada_url, vendidas_count, viewers_count, prendas:prendas(count)')
    .eq('tienda_id', tienda.id)
    .in('estado', ['programado', 'activo'])
    .order('inicia_at', { ascending: true });
  const dropIds = (drops ?? []).map(drop => drop.id);

  const { count: totalDrops } = await supabase
    .from('drops')
    .select('id', { count: 'exact', head: true })
    .eq('tienda_id', tienda.id);

  const { count: totalPrendas } = await supabase
    .from('prendas')
    .select('id', { count: 'exact', head: true })
    .eq('tienda_id', tienda.id);

  // Inventario público: prendas con unidades disponibles para catálogo.
  // Se incluyen prendas con cantidad > 0 O con cantidades_por_talla definido
  // (productos multi-talla donde el stock real está en cantidades_por_talla, no en cantidad).
  const { data: prendasDisponibles } = await supabase
    .from('prendas')
    .select('id, nombre, precio, cantidad, cantidades_por_talla, categoria, talla, tallas, marca, fotos, estado, drop_id, created_at')
    .eq('tienda_id', tienda.id)
    .is('drop_id', null)
    .or('cantidad.gt.0,cantidades_por_talla.not.is.null')
    .or('estado.is.null,estado.eq.disponible,estado.eq.remanente')
    .order('created_at', { ascending: false });

  let prendasDrops = [] as Array<
    Pick<Database['public']['Tables']['prendas']['Row'], 'id' | 'drop_id' | 'talla' | 'tallas' | 'cantidad' | 'cantidades_por_talla' | 'estado' | 'nombre' | 'precio' | 'fotos' | 'marca'>
  >;

  if (dropIds.length > 0) {
    const { data } = await supabase
      .from('prendas')
      .select('id, drop_id, talla, tallas, cantidad, cantidades_por_talla, estado, nombre, precio, fotos, marca')
      .eq('tienda_id', tienda.id)
      .in('drop_id', dropIds)
      .gt('cantidad', 0)
      .or('estado.is.null,estado.eq.disponible,estado.eq.remanente');

    prendasDrops = data ?? [];
  }

  // Categorías: primero intenta opciones_catalogo, si falla o está vacío usa las de las prendas
  let categoriasCatalogo: string[] = [];
  try {
    const admin = await createServiceClient();
    const { data } = await admin
      .from('opciones_catalogo')
      .select('nombre')
      .eq('tienda_id', tienda.id)
      .eq('tipo', 'categoria')
      .eq('activo', true)
      .order('orden', { ascending: true })
      .order('nombre', { ascending: true });

    categoriasCatalogo = (data ?? []).map(c => c.nombre).filter(Boolean);
  } catch {
    categoriasCatalogo = [];
  }

  // Fallback: si no hay categorías configuradas, derivarlas de las prendas disponibles
  if (categoriasCatalogo.length === 0 && prendasDisponibles && prendasDisponibles.length > 0) {
    const cats = Array.from(
      new Set(
        prendasDisponibles
          .map(p => p.categoria)
          .filter((c): c is string => !!c && c.trim() !== '')
          .map(c => c.trim())
      )
    ).sort();
    categoriasCatalogo = cats;
  }

  return (
    <TiendaPageClient
      tienda={tienda}
      drops={drops ?? []}
      stats={{ drops: totalDrops ?? 0, prendas: totalPrendas ?? 0 }}
      prendasDisponibles={prendasDisponibles ?? []}
      prendasDrops={prendasDrops}
      categoriasCatalogo={categoriasCatalogo}
      tiendaEmail={tienda.contact_email ?? ''}
      isOwnerPreview={isOwnerPreview}
    />
  );
}
