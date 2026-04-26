import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

// sessionStorage: la sesión muere cuando se cierra el navegador/pestaña
const sessionStorage =
  typeof window !== "undefined"
    ? {
        getItem: (key: string) => window.sessionStorage.getItem(key),
        setItem: (key: string, value: string) =>
          window.sessionStorage.setItem(key, value),
        removeItem: (key: string) => window.sessionStorage.removeItem(key),
      }
    : undefined;

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { storage: sessionStorage }
  );
}
