'use server';

import { createClient } from '@/lib/supabase/server';
import type { CatalogOptionInput, TipoNegocio } from '@/lib/catalog-options';

export async function obtenerOpcionesCatalogo(tiendaId?: string | null): Promise<{
  error?: string;
  tipoNegocio: TipoNegocio;
  opciones: CatalogOptionInput[];
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'No autorizado', tipoNegocio: 'ropa', opciones: [] };
  }

  let query = supabase
    .from('tiendas')
    .select('id, tipo_negocio')
    .eq('user_id', user.id);

  if (tiendaId) {
    query = query.eq('id', tiendaId);
  }

  const { data: tienda, error: tiendaError } = await query.single();

  if (tiendaError || !tienda) {
    return { error: tiendaError?.message ?? 'Tienda no encontrada', tipoNegocio: 'ropa', opciones: [] };
  }

  const { data, error } = await supabase
    .from('opciones_catalogo')
    .select('tipo, nombre, activo, orden')
    .eq('tienda_id', tienda.id)
    .order('orden', { ascending: true })
    .order('nombre', { ascending: true });

  if (error) {
    return {
      error: error.message,
      tipoNegocio: (tienda.tipo_negocio as TipoNegocio) ?? 'ropa',
      opciones: [],
    };
  }

  return {
    tipoNegocio: (tienda.tipo_negocio as TipoNegocio) ?? 'ropa',
    opciones: (data ?? []) as CatalogOptionInput[],
  };
}
