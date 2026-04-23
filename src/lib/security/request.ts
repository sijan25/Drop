import { createHash } from 'crypto';
import { headers } from 'next/headers';
import type { NextRequest } from 'next/server';
import { createServiceClient, getServiceRoleConfigError } from '@/lib/supabase/server';

const ORIGIN_ERROR = 'Solicitud no válida. Refrescá la página e intentá de nuevo.';
const RATE_LIMIT_ERROR = 'Demasiados intentos. Esperá un momento e intentá de nuevo.';

type HeaderReader = {
  get(name: string): string | null;
};

type RateLimitRpcClient = {
  rpc: (
    fn: 'check_rate_limit',
    args: { p_key: string; p_limit: number; p_window_seconds: number }
  ) => Promise<{ data: boolean | null; error: { message: string } | null }>;
};

function firstHeaderValue(value: string | null) {
  return value?.split(',')[0]?.trim() || null;
}

function normalizeOrigin(value: string | null | undefined) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function originFromHost(host: string | null, proto: string | null) {
  const cleanHost = firstHeaderValue(host);
  if (!cleanHost) return null;
  const protocol = firstHeaderValue(proto) ?? (cleanHost.startsWith('localhost') || cleanHost.startsWith('127.0.0.1') ? 'http' : 'https');
  return normalizeOrigin(`${protocol}://${cleanHost}`);
}

function allowedOriginsFromHeaders(source: HeaderReader) {
  const origins = new Set<string>();
  const forwardedHost = source.get('x-forwarded-host');
  const host = source.get('host');
  const forwardedProto = source.get('x-forwarded-proto');

  const currentOrigin = originFromHost(forwardedHost ?? host, forwardedProto);
  if (currentOrigin) origins.add(currentOrigin);

  [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
  ].forEach(value => {
    const origin = normalizeOrigin(value);
    if (origin) origins.add(origin);
  });

  if (process.env.NODE_ENV !== 'production') {
    origins.add('http://localhost:3000');
    origins.add('http://127.0.0.1:3000');
  }

  return origins;
}

function validateOrigin(source: HeaderReader) {
  const origin = normalizeOrigin(source.get('origin'));
  if (!origin) return process.env.NODE_ENV === 'production' ? ORIGIN_ERROR : null;

  return allowedOriginsFromHeaders(source).has(origin) ? null : ORIGIN_ERROR;
}

function getClientIp(source: HeaderReader) {
  return (
    firstHeaderValue(source.get('cf-connecting-ip')) ||
    firstHeaderValue(source.get('x-real-ip')) ||
    firstHeaderValue(source.get('x-forwarded-for')) ||
    'unknown'
  );
}

function hashKey(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export async function requireTrustedServerActionOrigin() {
  const headerStore = await headers();
  return validateOrigin(headerStore);
}

export function requireTrustedRequestOrigin(request: NextRequest) {
  return validateOrigin(request.headers);
}

export async function checkServerRateLimit(scope: string, limit: number, windowSeconds: number, identity = '') {
  const serviceRoleError = getServiceRoleConfigError();
  if (serviceRoleError) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[security] Rate limit skipped in development: ${serviceRoleError}`);
      return null;
    }
    return serviceRoleError;
  }

  const headerStore = await headers();
  const key = hashKey(`${scope}:${getClientIp(headerStore)}:${identity}`);
  const service = await createServiceClient();
  const { data, error } = await (service as unknown as RateLimitRpcClient).rpc('check_rate_limit', {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });

  if (error) {
    console.error('[security] Rate limit error:', error);
    return 'No pudimos validar la seguridad de la solicitud. Intentá de nuevo.';
  }

  return data === false ? RATE_LIMIT_ERROR : null;
}

export async function checkRequestRateLimit(request: NextRequest, scope: string, limit: number, windowSeconds: number, identity = '') {
  const serviceRoleError = getServiceRoleConfigError();
  if (serviceRoleError) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[security] Rate limit skipped in development: ${serviceRoleError}`);
      return null;
    }
    return serviceRoleError;
  }

  const key = hashKey(`${scope}:${getClientIp(request.headers)}:${identity}`);
  const service = await createServiceClient();
  const { data, error } = await (service as unknown as RateLimitRpcClient).rpc('check_rate_limit', {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });

  if (error) {
    console.error('[security] Rate limit error:', error);
    return 'No pudimos validar la seguridad de la solicitud. Intentá de nuevo.';
  }

  return data === false ? RATE_LIMIT_ERROR : null;
}

export async function guardServerMutation(scope: string, limit: number, windowSeconds: number, identity = '') {
  return (await requireTrustedServerActionOrigin()) ?? (await checkServerRateLimit(scope, limit, windowSeconds, identity));
}
