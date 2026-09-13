// PUT /api/categories/order — simpan urutan satu jenis setelah diseret.
import { z } from "zod";
import { reorderCategories } from "@/backend/services/categories";
import { currentUserId, fail } from "@/app/api/session";

export const dynamic = "force-dynamic";

const Body = z.object({
  kind: z.enum(["expense", "income"]),
  ids: z
    .array(z.uuid())
    .min(1)
    .max(200)
    .refine((ids) => new Set(ids).size === ids.length, "Ada id yang dobel"),
});

export async function PUT(request: Request) {
  const userId = await currentUserId();
  if (!userId) return fail(401, "UNAUTHORIZED", "Butuh session yang valid");

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return fail(400, "INVALID_JSON", "Body bukan JSON yang valid");
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return fail(400, "INVALID_BODY", z.prettifyError(parsed.error));

  const ok = await reorderCategories(userId, parsed.data.kind, parsed.data.ids);
  return ok
    ? new Response(null, { status: 204 })
    : fail(404, "NOT_FOUND", "Ada kategori yang tidak ditemukan atau beda jenis");
}
