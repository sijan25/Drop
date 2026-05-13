import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const ENCRYPTED_PREFIX = 'enc:v1:';

function getEncryptionKey() {
  const secret = process.env.PIXELPAY_CREDENTIALS_SECRET?.trim()
    || process.env.ORDER_ACCESS_TOKEN_SECRET?.trim();

  if (!secret || secret.length < 32) {
    throw new Error('PIXELPAY_CREDENTIALS_SECRET debe tener al menos 32 caracteres.');
  }

  return createHash('sha256').update(secret).digest();
}

export function encryptBoxfulPassword(value: string) {
  const clean = value.trim();
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

export function decryptBoxfulPassword(value: string | null | undefined) {
  const raw = value?.trim();
  if (!raw) return null;
  if (!raw.startsWith(ENCRYPTED_PREFIX)) return raw;

  const payload = raw.slice(ENCRYPTED_PREFIX.length);
  const [ivRaw, tagRaw, encryptedRaw] = payload.split('.');
  if (!ivRaw || !tagRaw || !encryptedRaw) throw new Error('Credencial Boxful inválida.');

  const decipher = createDecipheriv('aes-256-gcm', getEncryptionKey(), Buffer.from(ivRaw, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}
