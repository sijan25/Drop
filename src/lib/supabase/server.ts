import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import { BUYER_AUTH_COOKIE } from "./constants";

function getJwtRole(token: string) {
  const [, payload] = token.split(".");
  if (!payload) return null;

  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = Buffer.from(normalized, "base64").toString("utf8");
    const parsed = JSON.parse(decoded) as { role?: unknown };
    return typeof parsed.role === "string" ? parsed.role : null;
  } catch {
    return null;
  }
}

export function getServiceRoleConfigError() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceRoleKey) {
    return "SUPABASE_SERVICE_ROLE_KEY no está configurada.";
  }

  if (serviceRoleKey === process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()) {
    return "SUPABASE_SERVICE_ROLE_KEY está usando la anon key. Configurá la service role key real de Supabase.";
  }

  const role = serviceRoleKey.includes(".") ? getJwtRole(serviceRoleKey) : null;
  if (role && role !== "service_role") {
    return "SUPABASE_SERVICE_ROLE_KEY no tiene rol service_role.";
  }

  return null;
}

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from Server Component — cookies set in middleware
          }
        },
      },
    }
  );
}

export async function createServiceClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

export async function createBuyerClient() {
  const cookieStore = await cookies();
  const buyerCookieDefaults = {
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        name: BUYER_AUTH_COOKIE,
        ...buyerCookieDefaults,
      },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              const nextOptions = {
                ...options,
                ...buyerCookieDefaults,
              };

              // La sesión compradora no debe sobrevivir al cierre del navegador.
              // Preservamos maxAge=0 solo cuando Supabase está limpiando la cookie.
              if (nextOptions.maxAge !== 0) {
                delete nextOptions.maxAge;
                delete nextOptions.expires;
              }

              cookieStore.set(name, value, nextOptions);
            });
          } catch {
            // Called from Server Component — cookies set by browser/client flows.
          }
        },
      },
    }
  );
}
