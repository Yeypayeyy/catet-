// Daftar transaksi (dengan filter + pagination) dan input manual.
import { z } from "zod";
import { createTransaction, listTransactions } from "@/backend/services/transactions";
import { currentUserId, fail } from "@/app/api/session";

export const dynamic = "force-dynamic";

const Query = z.object({
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
  category_id: z.uuid().optional(),
  account_id: z.uuid().optional(),
  direction: z.enum(["debit", "credit"]).optional(),
  // Antrian review: /api/transactions?is_reviewed=false
  is_reviewed: z.enum(["true", "false"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const Body = z.object({
  account_id: z.uuid(),
  category_id: z.uuid().nullish(),
  // String, bukan number. Uang tidak pernah lewat float, termasuk di JSON.
  amount: z.string().regex(/^\d+$/, "Harus bilangan bulat positif satuan minor"),
  direction: z.enum(["debit", "credit"]),
  occurred_at: z.iso.datetime({ offset: true }).optional(),
  note: z.string().max(500).nullish(),
  merchant: z.string().max(200).nullish(),
  tag_ids: z.array(z.uuid()).max(20).optional(),
});

export async function GET(request: Request) {
  const userId = await currentUserId();
  if (!userId) return fail(401, "UNAUTHORIZED", "Butuh session yang valid");

  const parsed = Query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return fail(400, "INVALID_QUERY", z.prettifyError(parsed.error));
  const q = parsed.data;

  return Response.json(
    await listTransactions(userId, {
      from: q.from ? new Date(q.from) : undefined,
      to: q.to ? new Date(q.to) : undefined,
      categoryId: q.category_id,
      accountId: q.account_id,
      direction: q.direction,
      isReviewed: q.is_reviewed === undefined ? undefined : q.is_reviewed === "true",
      limit: q.limit,
      offset: q.offset,
    }),
  );
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

  const amount = BigInt(b.amount);
  if (amount <= 0n) return fail(400, "INVALID_BODY", "Nominal harus lebih dari nol");

  const result = await createTransaction(userId, {
    accountId: b.account_id,
    categoryId: b.category_id ?? null,
    amount,
    direction: b.direction,
    occurredAt: b.occurred_at ? new Date(b.occurred_at) : undefined,
    note: b.note ?? null,
    merchant: b.merchant ?? null,
    tagIds: b.tag_ids,
  });

  // Relasi milik user lain dijawab 404, bukan 403.
  if (result.status !== "ok") {
    return fail(404, "NOT_FOUND", result.status === "bad_ref" ? result.message : "Tidak ditemukan");
  }
  return Response.json(result.transaction, { status: 201 });
}
