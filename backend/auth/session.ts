// Jembatan antara identitas Supabase Auth dan tabel users milik aplikasi.
//
// id di tabel users SAMA dengan id di auth.users. Jadi seluruh relasi yang sudah
// ada (devices, accounts, transactions, ...) tidak perlu diubah sama sekali.
//
// ponytail: tidak dipasang foreign key ke auth.users. Alasannya user demo hasil
// seed tidak punya pasangan di auth.users dan Tasker masih memakainya. Pasang FK
// setelah seed dibuang, kalau memang butuh jaminan integritas dari database.
import { eq } from "drizzle-orm";
import { db } from "@/backend/db";
import { users } from "@/backend/db/schema";
import { createSupabaseServerClient, type CookieStore } from "@/backend/auth/supabase";

export type SessionUser = { userId: string; email: string };

/** Session yang sedang berjalan, atau null kalau belum login. */
export async function getSessionUser(cookies: CookieStore): Promise<SessionUser | null> {
  const supabase = createSupabaseServerClient(cookies);
  // getUser(), bukan getSession(): yang ini memverifikasi token ke Supabase,
  // sedangkan getSession() cuma percaya isi cookie.
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.email) return null;
  return { userId: data.user.id, email: data.user.email };
}

/** Buat baris profil kalau ini login pertama. Idempoten. */
export async function ensureProfile(user: SessionUser, name: string | null): Promise<void> {
  await db
    .insert(users)
    .values({ id: user.userId, email: user.email, name })
    .onConflictDoUpdate({ target: users.id, set: { email: user.email, updatedAt: new Date() } });
}

/** Profil aplikasi milik session ini, atau null kalau belum pernah login. */
export async function getProfile(cookies: CookieStore) {
  const session = await getSessionUser(cookies);
  if (!session) return null;

  const [profile] = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  return profile ?? null;
}
