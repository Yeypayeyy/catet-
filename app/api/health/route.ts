import { sql } from "@/server/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await sql`select 1`;
    return Response.json({ ok: true, db: "up" });
  } catch {
    return Response.json(
      { error: { code: "DB_UNAVAILABLE", message: "Database tidak dapat dihubungi" } },
      { status: 503 },
    );
  }
}
