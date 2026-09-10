import { z } from "zod";
import { ringkasan } from "@/backend/services/summary";
import { currentUserId, fail } from "@/app/api/session";

export const dynamic = "force-dynamic";

const Query = z.object({
  // Bulan menurut jam Jakarta, format YYYY-MM. Kosong = bulan berjalan.
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Format bulan harus YYYY-MM")
    .optional(),
});

export async function GET(request: Request) {
  const userId = await currentUserId();
  if (!userId) return fail(401, "UNAUTHORIZED", "Butuh session yang valid");

  const parsed = Query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return fail(400, "INVALID_QUERY", z.prettifyError(parsed.error));

  return Response.json(await ringkasan(userId, parsed.data.month));
}
