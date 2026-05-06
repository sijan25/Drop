export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 32;
export const USERNAME_CHANGE_LIMIT = 3;
export const USERNAME_CHANGE_COOLDOWN_DAYS = 30;
export const STORE_USERNAME_TAKEN_ERROR = 'Ese link público ya está en uso. Probá con otro nombre.';

export const RESERVED_STORE_USERNAMES = new Set([
  '_next',
  'admin',
  'api',
  'app',
  'auth',
  'carrito',
  'checkout',
  'comprobantes',
  'configuracion',
  'dashboard',
  'drops',
  'favicon.ico',
  'inventario',
  'login',
  'onboarding',
  'pedido',
  'pedidos',
  'public',
  'signup',
  'soporte',
  'support',
  'www',
]);

export const STORE_USERNAME_RE = /^[a-z0-9-]{3,32}$/;

export function normalizeStoreUsername(username: string) {
  return username.trim().toLowerCase();
}

export function validateStoreUsername(username: string) {
  const normalized = normalizeStoreUsername(username);

  if (!STORE_USERNAME_RE.test(normalized)) {
    return {
      username: normalized,
      error: 'El link debe tener 3 a 32 caracteres y usar solo letras minúsculas, números o guiones.',
    };
  }

  if (normalized.startsWith('-') || normalized.endsWith('-') || normalized.includes('--')) {
    return {
      username: normalized,
      error: 'El link no puede iniciar/terminar con guion ni tener guiones dobles.',
    };
  }

  if (RESERVED_STORE_USERNAMES.has(normalized)) {
    return {
      username: normalized,
      error: 'Ese link está reservado por la plataforma. Probá con otro.',
    };
  }

  return { username: normalized, error: null };
}
