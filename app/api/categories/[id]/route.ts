import { z } from "zod";
import { deleteCategory, updateCategory } from "@/backend/services/categories";
import { currentUserId, fail } from "@/app/api/session";

export const dynamic = "force-dynamic";

// kind sengaja tidak ada: transaksi lama sudah memakai kategori ini di arah itu.
const Body = z
  .object({
    name: z.string().trim().min(1).max(100),
    icon: z.string().trim().max(16).nullable(),
    hidden: z.boolean(),
  })
  .partial()
  .refine((b) => Object.keys(b).length > 0, "Tidak ada yang diubah");

const notFound = () => fail(404, "NOT_FOUND", "Kategori tidak ditemukan");

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId();
  if (!userId) return fail(401, "UNAUTHORIZED", "Butuh session yang valid");

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return notFound();

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return fail(400, "INVALID_JSON", "Body bukan JSON yang valid");
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return fail(400, "INVALID_BODY", z.prettifyError(parsed.error));
  const b = parsed.data;

  const row = await updateCategory(userId, id, {
    ...b,
    // "" berarti ikonnya dihapus; undefined berarti tidak diubah.
    ...(b.icon !== undefined && { icon: b.icon || null }),
  });
  // Milik user lain dijawab 404, bukan 403: keberadaannya pun tidak dibocorkan.
  return row ? Response.json(row) : notFound();
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId();
  if (!userId) return fail(401, "UNAUTHORIZED", "Butuh session yang valid");

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return notFound();

  const hasil = await deleteCategory(userId, id);
  if (hasil === "not_found") return notFound();
  if (hasil === "default") {
    return fail(409, "DEFAULT_CATEGORY", "Kategori bawaan disembunyikan, bukan dihapus.");
  }
  return new Response(null, { status: 204 });
}
