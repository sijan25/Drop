import { NextResponse, type NextRequest } from 'next/server';
import { createBuyerClient, createClient as createServerAuthClient } from '@/lib/supabase/server';

function getSafeNext(rawNext: string | null, fallback: string) {
  const next = rawNext ?? fallback;
  return next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\')
    ? next
    : fallback;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const scope = searchParams.get('scope') === 'buyer' ? 'buyer' : 'seller';
  const next = getSafeNext(
    searchParams.get('next'),
    scope === 'buyer' ? '/auth/reset-password?scope=buyer' : '/dashboard',
  );

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = scope === 'buyer'
    ? await createBuyerClient()
    : await createServerAuthClient();

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      scope === 'buyer'
        ? `${origin}/auth/reset-password?scope=buyer&error=exchange_failed`
        : `${origin}/login?error=exchange_failed`,
    );
  }

  const nextUrl = new URL(next, origin);

  if (nextUrl.pathname === '/auth/reset-password') {
    if (scope === 'buyer') nextUrl.searchParams.set('scope', 'buyer');
    return NextResponse.redirect(nextUrl);
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=no_user`);
  }

  const { data: tienda } = await supabase
    .from('tiendas')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!tienda) {
    return NextResponse.redirect(`${origin}/onboarding`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
