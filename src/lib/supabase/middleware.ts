import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  const isDashboard =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/drops") ||
    pathname.startsWith("/inventario") ||
    pathname.startsWith("/pedidos") ||
    pathname.startsWith("/comprobantes") ||
    pathname.startsWith("/configuracion") ||
    pathname.startsWith("/billing");

  // Rutas de dashboard requieren sesión
  if (isDashboard && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Si hay sesión activa en /login → redirigir según si tiene tienda o no
  if (pathname === "/login" && user) {
    const { data: tienda } = await supabase
      .from("tiendas")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    const url = request.nextUrl.clone();
    url.pathname = tienda ? "/dashboard" : "/onboarding";
    return NextResponse.redirect(url);
  }

  // Si hay sesión en /onboarding y ya tiene tienda → redirigir a dashboard
  // (evita que alguien con tienda vuelva a ver el onboarding)
  // Si NO tiene tienda, dejar pasar normalmente (el onboarding es su destino correcto)
  if (pathname === "/onboarding" && user) {
    const { data: tienda } = await supabase
      .from("tiendas")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (tienda) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
    // Sin tienda: dejar pasar al onboarding sin redirigir
    return supabaseResponse;
  }

  return supabaseResponse;
}
