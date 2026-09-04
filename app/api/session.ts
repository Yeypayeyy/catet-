// Dipakai route handler yang butuh tahu siapa yang login.
// Bukan route (tidak bernama route.ts), cuma modul bantu di lapisan HTTP.
import { cookies } from "next/headers";
import { getSessionUser } from "@/backend/auth/session";

/** id user yang sedang login, atau null. proxy.ts sudah menyaring duluan. */
export async function currentUserId(): Promise<string | null> {
  const session = await getSessionUser(await cookies());
  return session?.userId ?? null;
}

export function fail(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}
