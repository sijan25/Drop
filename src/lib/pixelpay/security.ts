import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'crypto';
import { APP_URL } from '@/lib/config/platform';

const ENCRYPTED_PREFIX = 'enc:v1:';
const SANDBOX_KEY_ID = '1234567890';
const SANDBOX_SECRET = '@s4ndb0x-abcd-1234-n1l4-p1x3l';

function getEncryptionKey() {
  const secret = process.env.PIXELPAY_CREDENTIALS_SECRET?.trim()
    || process.env.ORDER_ACCESS_TOKEN_SECRET?.trim();

  if (!secret || secret.length < 32) {
    throw new Error('PIXELPAY_CREDENTIALS_SECRET debe tener al menos 32 caracteres.');
  }

  return createHash('sha256').update(secret).digest();
}

export function sha512(value: string) {
  return createHash('sha512').update(value).digest('hex');
}

export function encryptPixelPaySecret(secret: string) {
  const clean = secret.trim();
  if (!clean) return null;
  if (clean.startsWith(ENCRYPTED_PREFIX)) return clean;

  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(clean, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${ENCRYPTED_PREFIX}${[
    iv.toString('base64url'),
    tag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.')}`;
}

export function decryptPixelPaySecret(secret: string | null | undefined) {
  const value = secret?.trim();
  if (!value) return null;
  if (!value.startsWith(ENCRYPTED_PREFIX)) return value;

  const payload = value.slice(ENCRYPTED_PREFIX.length);
  const [ivRaw, tagRaw, encryptedRaw] = payload.split('.');
  if (!ivRaw || !tagRaw || !encryptedRaw) {
    throw new Error('Credencial PixelPay inválida.');
  }

  const decipher = createDecipheriv('aes-256-gcm', getEncryptionKey(), Buffer.from(ivRaw, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

export function getPixelPayAuthHash(secret: string) {
  return sha512(secret);
}

export function getPixelPaySignature(opts: {
  keyId: string;
  orderId: string;
  secret: string;
  appUrl?: string;
}) {
  const payload = [opts.keyId, opts.orderId, opts.appUrl ?? APP_URL].join('|');
  return createHmac('sha3-512', opts.secret).update(payload).digest('hex');
}

export function getPixelPayServiceSignature(opts: {
  keyId: string;
  secret: string;
  fields: Array<string | number>;
}) {
  return createHmac('sha3-512', opts.secret).update(opts.fields.join('|')).digest('hex');
}

export function getSandboxPixelPayCredentials() {
  return {
    keyId: SANDBOX_KEY_ID,
    secret: SANDBOX_SECRET,
  };
}

export function getVoidSignature(opts: {
  authUserEmail: string;
  orderId: string;
  secret: string;
}) {
  const authUserHash = sha512(opts.authUserEmail.trim().toLowerCase());
  const voidSignature = sha512([authUserHash, opts.orderId, opts.secret].join('|'));
  return { authUserHash, voidSignature };
}
