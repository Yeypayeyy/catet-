import { z } from "zod";
import { createCategory, listCategories } from "@/backend/services/categories";
import { currentUserId, fail } from "@/app/api/session";

export const dynamic = "force-dynamic";

const Body = z.object({
  name: z.string().trim().min(1).max(100),
  // Tidak dicek apakah benar emoji: keyboard HP yang menjaga, dan teks
  // pendek lain tidak merusak apa pun. "" = tanpa ikon.
  icon: z.string().trim().max(16).nullish(),
  kind: z.enum(["expense", "income"]),
});

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return fail(401, "UNAUTHORIZED", "Butuh session yang valid");
  return Response.json({ items: await listCategories(userId) });
}

export async function POST(request: Request) {
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
  const b = parsed.data;

  return Response.json(
    await createCategory(userId, { name: b.name, icon: b.icon || null, kind: b.kind }),
    { status: 201 },
  );
}
