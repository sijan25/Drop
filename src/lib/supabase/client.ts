import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { BUYER_AUTH_COOKIE } from "./constants";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

let buyerClient: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function createBuyerClient() {
  if (buyerClient) return buyerClient;

  buyerClient = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      isSingleton: false,
      cookieOptions: {
        name: BUYER_AUTH_COOKIE,
        path: "/",
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      },
    }
  );

  return buyerClient;
}
