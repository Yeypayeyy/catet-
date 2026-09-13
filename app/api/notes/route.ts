// GET /api/notes?category_id=…&q=… — saran catatan untuk kolom Catatan.
import { z } from "zod";
import { noteSuggestions } from "@/backend/services/notes";
import { currentUserId, fail } from "@/app/api/session";

export const dynamic = "force-dynamic";

const Query = z.object({
  category_id: z.uuid().optional(),
  q: z.string().trim().max(100).optional(),
});

export async function GET(request: Request) {
  const userId = await currentUserId();
  if (!userId) return fail(401, "UNAUTHORIZED", "Butuh session yang valid");

  const parsed = Query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return fail(400, "INVALID_QUERY", z.prettifyError(parsed.error));

  return Response.json({
    items: await noteSuggestions(userId, {
      categoryId: parsed.data.category_id,
      q: parsed.data.q || undefined,
    }),
  });
}
