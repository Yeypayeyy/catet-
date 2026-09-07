// Dipakai route handler yang butuh tahu siapa yang login.
// Bukan route (tidak bernama route.ts), cuma modul bantu di lapisan HTTP.
import { cookies } from "next/headers";
import { verifyDeviceToken } from "@/backend/auth/device";
import { getSessionUser } from "@/backend/auth/session";

/** id user yang sedang login, atau null. proxy.ts sudah menyaring duluan. */
export async function currentUserId(): Promise<string | null> {
  const session = await getSessionUser(await cookies());
  return session?.userId ?? null;
}

/**
 * id user dari session ATAU dari token device. Dipakai endpoint yang dipanggil
 * dua-duanya: web (cookie) dan Android (Bearer wh_...).
 */
export async function actorUserId(request: Request): Promise<string | null> {
  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer wh_")) {
    return (await verifyDeviceToken(authorization))?.userId ?? null;
  }
  return await currentUserId();
}

export function fail(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}
