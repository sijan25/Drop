import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function buildCsp(nonce: string): string {
  const supabaseOrigin = (() => {
    try {
      return process.env.NEXT_PUBLIC_SUPABASE_URL
        ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
        : null;
    } catch { return null; }
  })();

  const supabaseHostname = (() => {
    try {
      return process.env.NEXT_PUBLIC_SUPABASE_URL
        ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
        : null;
    } catch { return null; }
  })();

  const isDev = process.env.NODE_ENV !== 'production';

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "form-action 'self'",
    ["img-src 'self' data: blob: https://res.cloudinary.com", supabaseOrigin].filter(Boolean).join(' '),
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    [`script-src 'self' 'nonce-${nonce}'`, isDev ? "'unsafe-eval'" : ''].filter(Boolean).join(' '),
    [
      "connect-src 'self'",
      supabaseOrigin,
      supabaseHostname ? `wss://${supabaseHostname}` : null,
      "https://api.cloudinary.com",
      "https://res.cloudinary.com",
      "https://api.resend.com",
      "https://pixelpay.dev",
      "https://*.pixelpay.app",
    ].filter(Boolean).join(' '),
    !isDev ? 'upgrade-insecure-requests' : '',
  ].filter(Boolean).join('; ');
}

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|icon\\.svg).*)'],
};
