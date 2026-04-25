'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  getCatalogDefaults,
  mergeCatalogOptions,
  type CatalogOptionInput,
  type TipoNegocio,
} from '@/lib/catalog-options';

type CatalogCache = { tipoNegocio: TipoNegocio; custom: CatalogOptionInput[] };
const catalogCache = new Map<string, CatalogCache>();

export function useCatalogOptions(tiendaId?: string | null) {
  const [custom, setCustom] = useState<CatalogOptionInput[]>([]);
  const [tipoNegocio, setTipoNegocio] = useState<TipoNegocio>('ropa');
  const fetchingRef = useRef(false);

  useEffect(() => {
    let active = true;

    (async () => {
      const supabase = createClient();
      let resolvedTiendaId = tiendaId ?? null;
      let resolvedTipo: TipoNegocio = 'ropa';

      if (!resolvedTiendaId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: tienda } = await supabase
          .from('tiendas')
          .select('id, tipo_negocio')
          .eq('user_id', user.id)
          .single();
        resolvedTiendaId = tienda?.id ?? null;
        resolvedTipo = (tienda?.tipo_negocio as TipoNegocio) ?? 'ropa';
      } else {
        const { data: tienda } = await supabase
          .from('tiendas')
          .select('tipo_negocio')
          .eq('id', resolvedTiendaId)
          .single();
        resolvedTipo = (tienda?.tipo_negocio as TipoNegocio) ?? 'ropa';
      }

      if (!resolvedTiendaId) return;

      const cacheKey = resolvedTiendaId;
      const cached = catalogCache.get(cacheKey);
      if (cached) {
        if (active) { setTipoNegocio(cached.tipoNegocio); setCustom(cached.custom); }
        return;
      }

      if (fetchingRef.current) return;
      fetchingRef.current = true;

      const { data } = await supabase
        .from('opciones_catalogo')
        .select('tipo, nombre, activo, orden')
        .eq('tienda_id', resolvedTiendaId)
        .order('orden', { ascending: true })
        .order('nombre', { ascending: true });

      fetchingRef.current = false;
      if (!active) return;

      const result = { tipoNegocio: resolvedTipo, custom: (data ?? []) as CatalogOptionInput[] };
      catalogCache.set(cacheKey, result);
      setTipoNegocio(result.tipoNegocio);
      setCustom(result.custom);
    })();

    return () => { active = false; };
  }, [tiendaId]);

  return useMemo(() => {
    const defaults = getCatalogDefaults(tipoNegocio);
    return {
      tipoNegocio,
      categorias: mergeCatalogOptions(defaults.categorias, custom, 'categoria'),
      tallas: mergeCatalogOptions(defaults.tallas, custom, 'talla'),
    };
  }, [tipoNegocio, custom]);
}
