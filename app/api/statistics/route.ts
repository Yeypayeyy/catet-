// GET /api/statistics?month=2026-09 | ?year=2026 — tanpa keduanya = bulan berjalan WIB.
import { z } from "zod";
import { statistics } from "@/backend/services/statistics";
import { batasBulan, batasTahun } from "@/backend/services/wib";
import { currentUserId, fail } from "@/app/api/session";

export const dynamic = "force-dynamic";

const Query = z
  .object({
    month: z
      .string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Format bulan harus YYYY-MM")
      .optional(),
    year: z.coerce.number().int().min(2000).max(2100).optional(),
  })
  .refine((q) => !(q.month && q.year), "Pilih salah satu: month atau year");

export async function GET(request: Request) {
  const userId = await currentUserId();
  if (!userId) return fail(401, "UNAUTHORIZED", "Butuh session yang valid");

  const parsed = Query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return fail(400, "INVALID_QUERY", z.prettifyError(parsed.error));
  const { month, year } = parsed.data;

  return Response.json(await statistics(userId, year ? batasTahun(year) : batasBulan(month)));
}
