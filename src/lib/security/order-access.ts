import { createHmac, timingSafeEqual } from 'crypto';

const TOKEN_VERSION = 'v2';
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 días
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

function getOrderTokenSecret() {
  const secret = process.env.ORDER_ACCESS_TOKEN_SECRET?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!secret || secret.length < 32) {
    throw new Error('ORDER_ACCESS_TOKEN_SECRET no está configurado con un valor seguro.');
  }
  return secret;
}

function sign(value: string) {
  return createHmac('sha256', getOrderTokenSecret()).update(value).digest('base64url');
}

export function createOrderAccessToken(order: { id: string; numero: string }) {
  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const payload = `${TOKEN_VERSION}.${order.id}.${exp}`;
  return `${payload}.${sign(`${payload}.${order.numero}`)}`;
}

export function verifyOrderAccessToken(token: string | null | undefined, order: { id: string; numero: string }) {
  if (!token) return false;

  const parts = token.split('.');

  // Soporte legado: tokens v1 sin expiración (formato: v1.orderId.signature)
  if (parts.length === 3 && parts[0] === 'v1') {
    const [version, orderId, signature] = parts;
    if (orderId !== order.id || !signature) return false;
    const expected = sign(`${version}.${orderId}.${order.numero}`);
    const expectedBuffer = Buffer.from(expected);
    const actualBuffer = Buffer.from(signature);
    // Tokens v1 ya no se aceptan — fuerza reemisión
    void expectedBuffer;
    void actualBuffer;
    return false;
  }

  // Tokens v2: version.orderId.exp.signature
  if (parts.length !== 4) return false;
  const [version, orderId, expStr, signature] = parts;

  if (version !== TOKEN_VERSION || orderId !== order.id || !expStr || !signature) return false;

  const exp = parseInt(expStr, 10);
  if (!Number.isInteger(exp) || Math.floor(Date.now() / 1000) > exp) return false;

  const payload = `${version}.${orderId}.${exp}`;
  const expected = sign(`${payload}.${order.numero}`);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
}

export function buildOrderTrackingUrl(order: { id: string; numero: string }) {
  const url = new URL(`/pedido/${encodeURIComponent(order.numero)}`, APP_URL);
  url.searchParams.set('t', createOrderAccessToken(order));
  return url.toString();
}
