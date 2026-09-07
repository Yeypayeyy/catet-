// Detail, ubah, hapus satu transaksi.
//
// PATCH dipakai dua pihak: web (cookie session) dan Android saat user menekan
// tombol kategori di notifikasi (Bearer wh_...). Karena itu autentikasinya
// lewat actorUserId, bukan currentUserId.
import { z } from "zod";
import {
  getTransaction,
  softDeleteTransaction,
  updateTransaction,
} from "@/backend/services/transactions";
import { actorUserId, currentUserId, fail } from "@/app/api/session";

export const dynamic = "force-dynamic";

const Body = z
  .object({
    account_id: z.uuid(),
    category_id: z.uuid().nullable(),
    // String, bukan number. Uang tidak pernah lewat float, termasuk di JSON.
    amount: z.string().regex(/^\d+$/, "Harus bilangan bulat positif satuan minor"),
    direction: z.enum(["debit", "credit"]),
    occurred_at: z.iso.datetime({ offset: true }),
    note: z.string().max(500).nullable(),
    merchant: z.string().max(200).nullable(),
    is_reviewed: z.boolean(),
    tag_ids: z.array(z.uuid()).max(20),
  })
  .partial()
  .refine((b) => Object.keys(b).length > 0, "Tidak ada yang diubah");

const notFound = () => fail(404, "NOT_FOUND", "Transaksi tidak ditemukan");

function badId(id: string) {
  return !z.uuid().safeParse(id).success;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId();
  if (!userId) return fail(401, "UNAUTHORIZED", "Butuh session yang valid");

  const { id } = await params;
  if (badId(id)) return notFound();

  const tx = await getTransaction(userId, id);
  // Milik user lain dijawab 404, bukan 403: keberadaannya pun tidak dibocorkan.
  return tx ? Response.json(tx) : notFound();
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await actorUserId(request);
  if (!userId) return fail(401, "UNAUTHORIZED", "Butuh session atau token device yang valid");

  const { id } = await params;
  if (badId(id)) return notFound();

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return fail(400, "INVALID_JSON", "Body bukan JSON yang valid");
  }

  const parsed = Body.safeParse(raw);
  if (!parsed.success) return fail(400, "INVALID_BODY", z.prettifyError(parsed.error));
  const b = parsed.data;

  if (b.amount !== undefined && BigInt(b.amount) <= 0n) {
    return fail(400, "INVALID_BODY", "Nominal harus lebih dari nol");
  }

  const result = await updateTransaction(userId, id, {
    ...(b.account_id !== undefined && { accountId: b.account_id }),
    ...(b.category_id !== undefined && { categoryId: b.category_id }),
    ...(b.amount !== undefined && { amount: BigInt(b.amount) }),
    ...(b.direction !== undefined && { direction: b.direction }),
    ...(b.occurred_at !== undefined && { occurredAt: new Date(b.occurred_at) }),
    ...(b.note !== undefined && { note: b.note }),
    ...(b.merchant !== undefined && { merchant: b.merchant }),
    ...(b.is_reviewed !== undefined && { isReviewed: b.is_reviewed }),
    ...(b.tag_ids !== undefined && { tagIds: b.tag_ids }),
  });

  if (result.status === "bad_ref") return fail(404, "NOT_FOUND", result.message);
  if (result.status === "not_found") return notFound();
  return Response.json(result.transaction);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId();
  if (!userId) return fail(401, "UNAUTHORIZED", "Butuh session yang valid");

  const { id } = await params;
  if (badId(id)) return notFound();

  // Soft delete: deleted_at, jangan hard delete.
  return (await softDeleteTransaction(userId, id))
    ? new Response(null, { status: 204 })
    : notFound();
}
