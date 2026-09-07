// Pemeriksaan yang butuh database sungguhan: jalankan `pnpm test:db`.
//
// Yang dijaga di sini cuma satu hal, tapi hal yang paling mahal kalau salah —
// setiap query difilter user_id, dan relasi milik user lain ditolak. Unit test
// biasa (`pnpm test`) tidak bisa membuktikan itu tanpa database.
//
// Dua user sementara dibuat lalu dihapus lagi di akhir; tidak menyentuh data
// yang sudah ada.
import assert from "node:assert/strict";
import { eq, inArray } from "drizzle-orm";
import { db, sql } from "@/backend/db";
import {
  accounts,
  categories,
  tags,
  transactionTags,
  transactions,
  users,
} from "@/backend/db/schema";
import {
  createTransaction,
  getTransaction,
  listTransactions,
  softDeleteTransaction,
  updateTransaction,
} from "@/backend/services/transactions";
import { CATALOG, createOwned, listOwned, softDeleteOwned, updateOwned } from "@/backend/services/catalog";

const ids: string[] = [];

async function mkUser(email: string) {
  const [u] = await db.insert(users).values({ email }).returning({ id: users.id });
  ids.push(u.id);
  const [a] = await db
    .insert(accounts)
    .values({ userId: u.id, name: "Cash", kind: "cash" })
    .returning({ id: accounts.id });
  const [c] = await db
    .insert(categories)
    .values({ userId: u.id, name: "Jajan" })
    .returning({ id: categories.id });
  return { id: u.id, accountId: a.id, categoryId: c.id };
}

const stamp = Date.now();
const A = await mkUser(`verify-a-${stamp}@catet.local`);
const B = await mkUser(`verify-b-${stamp}@catet.local`);

// --- catalog CRUD -----------------------------------------------------------
const tag = await createOwned(CATALOG.tags.table, CATALOG.tags.columns, A.id, { name: "reimburse" });
assert.equal(tag.name, "reimburse");

const listA = await listOwned(CATALOG.tags.table, CATALOG.tags.columns, A.id, CATALOG.tags.orderBy);
const listB = await listOwned(CATALOG.tags.table, CATALOG.tags.columns, B.id, CATALOG.tags.orderBy);
assert.equal(listA.length, 1, "tag milik A terlihat oleh A");
assert.equal(listB.length, 0, "tag milik A TIDAK terlihat oleh B");

assert.equal(
  await updateOwned(CATALOG.tags.table, CATALOG.tags.columns, B.id, tag.id as string, {
    name: "dibajak",
  }),
  null,
  "B tidak bisa mengubah tag milik A",
);
assert.equal(
  await softDeleteOwned(CATALOG.tags.table, B.id, tag.id as string),
  false,
  "B tidak bisa menghapus tag milik A",
);

// --- transaksi --------------------------------------------------------------
const made = await createTransaction(A.id, {
  accountId: A.accountId,
  amount: 25000n,
  direction: "debit",
  categoryId: A.categoryId,
  merchant: "Indomaret",
  tagIds: [tag.id as string],
});
assert.equal(made.status, "ok");
const tx = made.status === "ok" ? made.transaction : null!;
assert.equal(tx.amount, "25000", "bigint keluar sebagai string");
assert.equal(tx.source, "manual");
assert.equal(tx.is_reviewed, true);
assert.deepEqual(tx.tag_ids, [tag.id]);

assert.equal(await getTransaction(B.id, tx.id), null, "B tidak bisa membaca transaksi A");
assert.equal(
  (await updateTransaction(B.id, tx.id, { note: "dibajak" })).status,
  "not_found",
  "B tidak bisa mengubah transaksi A",
);
assert.equal(await softDeleteTransaction(B.id, tx.id), false, "B tidak bisa menghapus transaksi A");

// Relasi milik user lain ditolak, bukan diam-diam dipasang.
assert.equal(
  (await updateTransaction(A.id, tx.id, { categoryId: B.categoryId })).status,
  "bad_ref",
  "kategori milik B ditolak",
);
assert.equal(
  (await createTransaction(A.id, { accountId: B.accountId, amount: 1n, direction: "debit" })).status,
  "bad_ref",
  "account milik B ditolak",
);

// --- filter & pagination ----------------------------------------------------
await createTransaction(A.id, {
  accountId: A.accountId,
  amount: 1000n,
  direction: "credit",
  occurredAt: new Date("2020-01-01T00:00:00Z"),
  isReviewed: false,
});

const semua = await listTransactions(A.id, { limit: 50, offset: 0 });
assert.equal(semua.total, 2);
assert.equal(semua.items[0].id, tx.id, "urut terbaru dulu");

const belum = await listTransactions(A.id, { isReviewed: false, limit: 50, offset: 0 });
assert.equal(belum.total, 1, "antrian review menyaring is_reviewed=false");

const kredit = await listTransactions(A.id, { direction: "credit", limit: 50, offset: 0 });
assert.equal(kredit.total, 1);

const periode = await listTransactions(A.id, {
  from: new Date("2019-01-01T00:00:00Z"),
  to: new Date("2021-01-01T00:00:00Z"),
  limit: 50,
  offset: 0,
});
assert.equal(periode.total, 1, "filter periode");

const hal1 = await listTransactions(A.id, { limit: 1, offset: 0 });
assert.equal(hal1.items.length, 1);
assert.equal(hal1.next_offset, 1, "masih ada halaman berikutnya");
const hal2 = await listTransactions(A.id, { limit: 1, offset: 1 });
assert.equal(hal2.next_offset, null, "halaman terakhir");

// --- soft delete ------------------------------------------------------------
assert.equal(await softDeleteTransaction(A.id, tx.id), true);
assert.equal(await getTransaction(A.id, tx.id), null, "yang dihapus tidak terbaca lagi");
const [sisa] = await db
  .select({ id: transactions.id, deletedAt: transactions.deletedAt })
  .from(transactions)
  .where(eq(transactions.id, tx.id));
assert.ok(sisa.deletedAt, "barisnya masih ada, cuma ditandai deleted_at");

// --- bersih-bersih ----------------------------------------------------------
const txIds = (
  await db.select({ id: transactions.id }).from(transactions).where(inArray(transactions.userId, ids))
).map((r) => r.id);
if (txIds.length) {
  await db.delete(transactionTags).where(inArray(transactionTags.transactionId, txIds));
  await db.delete(transactions).where(inArray(transactions.id, txIds));
}
await db.delete(tags).where(inArray(tags.userId, ids));
await db.delete(categories).where(inArray(categories.userId, ids));
await db.delete(accounts).where(inArray(accounts.userId, ids));
await db.delete(users).where(inArray(users.id, ids));

console.log("SEMUA VERIFIKASI 1.4 LULUS");
await sql.end();
