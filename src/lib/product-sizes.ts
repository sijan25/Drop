export type ProductSizeSource = {
  talla?: string | null;
  tallas?: string[] | null;
  cantidad?: number | null;
  cantidades_por_talla?: unknown;
};

function sanitizeQuantity(value: unknown) {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.trunc(number));
}

function parseRawQuantityMap(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return new Map<string, number>();

  const result = new Map<string, number>();
  for (const [key, value] of Object.entries(input)) {
    const size = key.trim();
    if (!size) continue;
    result.set(size.toLowerCase(), sanitizeQuantity(value));
  }
  return result;
}

export function normalizeProductSizes(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const size = value?.trim();
    if (!size) continue;

    const key = size.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    result.push(size);
  }

  return result.slice(0, 40);
}

export function getProductSizes(product: ProductSizeSource) {
  return normalizeProductSizes([...(product.tallas ?? []), product.talla]);
}

export function getPrimaryProductSize(product: ProductSizeSource) {
  return getProductSizes(product)[0] ?? null;
}

export function getProductSizeQuantities(product: ProductSizeSource) {
  const sizes = getProductSizes(product);
  if (sizes.length === 0) return {} as Record<string, number>;

  const raw = parseRawQuantityMap(product.cantidades_por_talla);
  const hasExplicitInventory = sizes.some(size => raw.has(size.toLowerCase()));

  if (hasExplicitInventory) {
    return Object.fromEntries(
      sizes.map(size => [size, raw.get(size.toLowerCase()) ?? 0])
    );
  }

  const total = sanitizeQuantity(product.cantidad ?? 0);
  if (sizes.length === 1) {
    return { [sizes[0]]: total };
  }

  const distributed: Record<string, number> = {};
  let remaining = total;

  for (const size of sizes) {
    if (remaining > 0) {
      distributed[size] = 1;
      remaining -= 1;
    } else {
      distributed[size] = 0;
    }
  }

  if (remaining > 0) {
    distributed[sizes[0]] = (distributed[sizes[0]] ?? 0) + remaining;
  }

  return distributed;
}

export function getProductSizeQuantity(product: ProductSizeSource, selected?: string | null) {
  const requested = selected?.trim();
  if (!requested) return 0;

  const quantities = getProductSizeQuantities(product);
  const matchedKey = Object.keys(quantities).find(size => size.toLowerCase() === requested.toLowerCase());
  if (!matchedKey) return 0;
  return quantities[matchedKey] ?? 0;
}

export function getAvailableProductSizes(product: ProductSizeSource) {
  const quantities = getProductSizeQuantities(product);
  return getProductSizes(product).filter(size => (quantities[size] ?? 0) > 0);
}

export function getProductTotalQuantity(product: ProductSizeSource) {
  const sizes = getProductSizes(product);
  if (sizes.length === 0) return sanitizeQuantity(product.cantidad ?? 0);
  return Object.values(getProductSizeQuantities(product)).reduce((sum, qty) => sum + sanitizeQuantity(qty), 0);
}

export function formatProductSizes(product: ProductSizeSource) {
  const sizes = getProductSizes(product);
  if (sizes.length === 0) return null;
  return sizes.length === 1 ? `Talla ${sizes[0]}` : `Tallas ${sizes.join(', ')}`;
}

export function normalizeSelectedProductSize(product: ProductSizeSource, selected?: string | null) {
  const sizes = getProductSizes(product);
  if (sizes.length === 0) return null;

  const requested = selected?.trim();
  if (!requested) return null;

  const match = sizes.find(size => size.toLowerCase() === requested.toLowerCase());
  return match ?? null;
}

export function isProductSizeAllowed(product: ProductSizeSource, selected?: string | null) {
  const sizes = getProductSizes(product);
  if (sizes.length === 0) return true;
  return Boolean(normalizeSelectedProductSize(product, selected));
}

export function isProductSizeInStock(product: ProductSizeSource, selected?: string | null) {
  const sizes = getProductSizes(product);
  if (sizes.length === 0) return getProductTotalQuantity(product) > 0;

  const normalized = normalizeSelectedProductSize(product, selected);
  if (!normalized) return false;
  return getProductSizeQuantity(product, normalized) > 0;
}
