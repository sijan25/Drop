'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  getCatalogDefaults,
  mergeCatalogOptions,
  type CatalogOptionInput,
  type TipoNegocio,
} from '@/lib/catalog-options';
import { obtenerOpcionesCatalogo } from '@/lib/catalog-options/actions';

export function useCatalogOptions(tiendaId?: string | null) {
  const [custom, setCustom] = useState<CatalogOptionInput[]>([]);
  const [tipoNegocio, setTipoNegocio] = useState<TipoNegocio>('ropa');

  useEffect(() => {
    let active = true;

    (async () => {
      if (!active) return;

      const result = await obtenerOpcionesCatalogo(tiendaId);
      if (!active) return;

      setTipoNegocio(result.tipoNegocio);
      setCustom(result.opciones);
    })();

    return () => { active = false; };
  }, [tiendaId]);

  return useMemo(() => {
    const defaults = getCatalogDefaults(tipoNegocio);
    const hasCustomCategorias = custom.some(o => o.tipo === 'categoria');
    const hasCustomTallas = custom.some(o => o.tipo === 'talla');
    const categorias = mergeCatalogOptions(hasCustomCategorias ? [] : defaults.categorias, custom, 'categoria');
    const tallas = mergeCatalogOptions(hasCustomTallas ? [] : defaults.tallas, custom, 'talla');

    return {
      tipoNegocio,
      categorias: categorias.length > 0 ? categorias : [...defaults.categorias],
      tallas: tallas.length > 0 ? tallas : [...defaults.tallas],
    };
  }, [tipoNegocio, custom]);
}
