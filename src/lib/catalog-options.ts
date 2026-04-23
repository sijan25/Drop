export type TipoNegocio = 'ropa' | 'zapatos' | 'mixto';

export const DEFAULTS_CATALOGO: Record<TipoNegocio, { categorias: readonly string[]; tallas: readonly string[] }> = {
  ropa: {
    categorias: [
      'Blusas', 'Camisetas', 'Tops', 'Vestidos', 'Faldas',
      'Pantalones', 'Jeans', 'Shorts', 'Chaquetas', 'Blazers',
      'Suéteres', 'Abrigos', 'Ropa de niño', 'Accesorios', 'Otro',
    ],
    tallas: [
      'XS', 'S', 'M', 'L', 'XL', 'XXL',
      '24', '25', '26', '27', '28', '29', '30',
      '31', '32', '33', '34', '36', '38', '40',
      '6', '8', '10', '12', 'Única',
    ],
  },
  zapatos: {
    categorias: [
      'Tenis', 'Botas', 'Botines', 'Sandalias', 'Tacones',
      'Baletas', 'Mocasines', 'Zapatos casuales', 'Zapatos formales',
      'Chancletas', 'Niño', 'Accesorios', 'Otro',
    ],
    tallas: [
      '22', '23', '24', '25', '26',
      '35', '36', '37', '38', '39', '40', '41', '42',
      '38', '39', '40', '41', '42', '43', '44', '45',
      'Única',
    ].filter((v, i, a) => a.indexOf(v) === i),
  },
  mixto: {
    categorias: [
      'Ropa', 'Zapatos', 'Accesorios',
      'Blusas', 'Vestidos', 'Jeans', 'Tenis', 'Botas', 'Sandalias', 'Otro',
    ],
    tallas: [
      'XS', 'S', 'M', 'L', 'XL', 'XXL',
      '35', '36', '37', '38', '39', '40', '41', '42', '43', '44',
      'Única',
    ],
  },
};

export function getCatalogDefaults(tipo: TipoNegocio) {
  return DEFAULTS_CATALOGO[tipo] ?? DEFAULTS_CATALOGO.ropa;
}

// Legacy exports — kept for backward compat
export const PRENDA_CATEGORIAS = DEFAULTS_CATALOGO.ropa.categorias;
export const PRENDA_TALLAS = DEFAULTS_CATALOGO.ropa.tallas;

export type CatalogOptionTipo = 'categoria' | 'talla';

export type CatalogOptionInput = {
  tipo: CatalogOptionTipo;
  nombre: string;
  activo?: boolean | null;
  orden?: number | null;
};

export function mergeCatalogOptions(
  defaults: readonly string[],
  custom: CatalogOptionInput[],
  tipo: CatalogOptionTipo,
) {
  const seen = new Set<string>();
  const result: string[] = [];
  const relevantCustom = custom.filter(option => option.tipo === tipo);
  const hiddenDefaults = new Set(
    relevantCustom
      .filter(option => option.activo === false)
      .map(option => option.nombre.trim().toLowerCase())
      .filter(Boolean)
  );

  for (const name of defaults) {
    const key = name.trim().toLowerCase();
    if (!key || hiddenDefaults.has(key) || seen.has(key)) continue;
    seen.add(key);
    result.push(name);
  }

  relevantCustom
    .filter(option => option.activo !== false)
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || a.nombre.localeCompare(b.nombre))
    .forEach(option => {
      const name = option.nombre.trim();
      const key = name.toLowerCase();
      if (!name || seen.has(key)) return;
      seen.add(key);
      result.push(name);
    });

  return result;
}
