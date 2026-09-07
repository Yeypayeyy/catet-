// Kategorisasi cepat dari notifikasi Android maupun dari web.
import { z } from "zod";
import { categorizeTransaction } from "@/backend/services/transactions";
import { actorUserId, fail } from "@/app/api/session";

export const dynamic = "force-dynamic";

const Body = z
  .object({
    category_id: z.uuid(),
    note: z.string().max(500).nullish(),
    merchant: z.string().max(200).nullish(),
    is_reviewed: z.boolean(),
  })
  .partial()
  .refine((b) => Object.keys(b).length > 0, "Tidak ada yang diubah");

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await actorUserId(request);
  if (!userId) return fail(401, "UNAUTHORIZED", "Butuh session atau token device yang valid");

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return fail(404, "NOT_FOUND", "Transaksi tidak ditemukan");

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return fail(400, "INVALID_JSON", "Body bukan JSON yang valid");
  }

  const parsed = Body.safeParse(raw);
  if (!parsed.success) return fail(400, "INVALID_BODY", z.prettifyError(parsed.error));
  const b = parsed.data;

  const result = await categorizeTransaction(userId, id, {
    categoryId: b.category_id,
    ...(b.note !== undefined && { note: b.note ?? null }),
    ...(b.merchant !== undefined && { merchant: b.merchant ?? null }),
    ...(b.is_reviewed !== undefined && { isReviewed: b.is_reviewed }),
  });

  // Milik user lain dijawab 404, bukan 403.
  if (result.status === "not_found") return fail(404, "NOT_FOUND", "Transaksi tidak ditemukan");
  if (result.status === "bad_category") return fail(404, "NOT_FOUND", "Kategori tidak ditemukan");

  return Response.json({
    id: result.id,
    category_id: result.categoryId,
    is_reviewed: result.isReviewed,
  });
}
