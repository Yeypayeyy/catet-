// Total per bulan dalam satu tahun: GET /api/transactions/monthly?year=2026
import { z } from "zod";
import { monthlyTotals } from "@/backend/services/monthly";
import { currentUserId, fail } from "@/app/api/session";

export const dynamic = "force-dynamic";

const Query = z.object({
  // Default tahun berjalan menurut WIB, bukan UTC.
  year: z.coerce
    .number()
    .int()
    .min(2000)
    .max(2100)
    .default(() => new Date(Date.now() + 7 * 60 * 60 * 1000).getUTCFullYear()),
  category_id: z.uuid().optional(),
  // Tanggal awal bulan milik user; lihat bacaAwalBulan di lib/periode.ts.
  start_day: z.coerce.number().int().min(1).max(28).default(1),
});

export async function GET(request: Request) {
  const userId = await currentUserId();
  if (!userId) return fail(401, "UNAUTHORIZED", "Butuh session yang valid");

  const parsed = Query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return fail(400, "INVALID_QUERY", z.prettifyError(parsed.error));

  const { year, category_id, start_day } = parsed.data;
  return Response.json({ year, months: await monthlyTotals(userId, year, category_id, start_day) });
}
