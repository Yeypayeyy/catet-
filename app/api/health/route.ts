import { verifyDeviceToken } from "@/backend/auth/device";
import { sql } from "@/backend/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await sql`select 1`;
  } catch {
    return Response.json(
      { error: { code: "DB_UNAVAILABLE", message: "Database tidak dapat dihubungi" } },
      { status: 503 },
    );
  }

  // Tetap terbuka untuk monitor tanpa token. Tapi kalau Android yang menyapa,
  // token-nya diverifikasi supaya last_seen_at ikut tercatat — tanpa itu ping
  // enam jamannya cuma hiasan, dan web tidak punya dasar untuk memberi
  // peringatan "device sudah lama tidak terdengar".
  const authorization = request.headers.get("authorization");
  const device = authorization ? await verifyDeviceToken(authorization) : null;

  return Response.json({ ok: true, db: "up", device: device ? "seen" : null });
}
