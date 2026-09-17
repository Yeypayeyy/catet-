// GET /api/statistics?from=<ISO>&to=<ISO> | ?month=2026-09 | ?year=2026 —
// tanpa semuanya = bulan berjalan WIB. `to` inklusif, sama dengan /api/transactions.
// Layar Statistik selalu memakai from/to: klien yang tahu tanggal awal bulan user.
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
    from: z.iso.datetime({ offset: true }).optional(),
    to: z.iso.datetime({ offset: true }).optional(),
  })
  .refine((q) => [q.month, q.year, q.from].filter(Boolean).length <= 1, "Pilih salah satu: month, year, atau from/to")
  .refine((q) => !q.from === !q.to, "from dan to harus berpasangan")
  .refine((q) => !q.from || !q.to || new Date(q.from) <= new Date(q.to), "from harus sebelum to");

export async function GET(request: Request) {
  const userId = await currentUserId();
  if (!userId) return fail(401, "UNAUTHORIZED", "Butuh session yang valid");

  const parsed = Query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return fail(400, "INVALID_QUERY", z.prettifyError(parsed.error));
  const { month, year, from, to } = parsed.data;

  const rentang =
    from && to
      ? // Service memakai akhir eksklusif.
        { awal: new Date(from), akhir: new Date(new Date(to).getTime() + 1) }
      : year
        ? batasTahun(year)
        : batasBulan(month);
  return Response.json(await statistics(userId, rentang));
}
