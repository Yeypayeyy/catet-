// Client Supabase Auth untuk sisi server.
//
// Sengaja tidak mengimpor next/headers: backend/ harus bebas dari framework.
// Pemanggil di app/api/ yang menyodorkan cookie store-nya.
import { createServerClient } from "@supabase/ssr";

/** Bentuk minimal yang dibutuhkan @supabase/ssr. Cocok dengan hasil cookies() Next. */
export type CookieStore = {
  getAll: () => { name: string; value: string }[];
  set: (name: string, value: string, options?: Record<string, unknown>) => void;
};

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} belum diisi. Lihat .env.example`);
  return value;
}

export function createSupabaseServerClient(cookies: CookieStore) {
  return createServerClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
    cookies: {
      getAll: () => cookies.getAll(),
      setAll: (items) => {
        // Dipanggil saat token di-refresh. Di server component set() bisa melempar;
        // itu wajar dan aman diabaikan karena proxy.ts yang menyegarkan cookie.
        try {
          for (const { name, value, options } of items) cookies.set(name, value, options);
        } catch {
          /* read-only context */
        }
      },
    },
  });
}
