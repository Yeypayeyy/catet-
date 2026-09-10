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
  categoryRules,
  deadLetters,
  inboxEvents,
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
import { listDeadLetters, processEvent, reparseDeadLetter } from "@/backend/services/inbox";
import { pemberiSaran } from "@/backend/services/suggest-categories";
import { batasBulan, ringkasan } from "@/backend/services/summary";

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

// --- ringkasan ----------------------------------------------------------------
// Saldo dihitung, bukan disimpan. Yang dijaga: saldo awal ikut terhitung, arah
// transaksi tidak terbalik, dan batas bulan memakai jam Jakarta.
{
  const batas = batasBulan("2026-09", new Date("2026-09-10T02:00:00Z"));
  assert.equal(batas.awal.toISOString(), "2026-08-31T17:00:00.000Z", "1 Sep 00.00 WIB = 31 Agu 17.00 UTC");
  assert.equal(batas.akhir.toISOString(), "2026-09-30T17:00:00.000Z", "batas atas juga WIB");
  assert.equal(batas.label, "September");

  const [dompet] = await db
    .insert(accounts)
    .values({ userId: A.id, name: "Dompet", kind: "cash", initBalance: 100000n })
    .returning({ id: accounts.id });

  const buat = (amount: bigint, direction: "debit" | "credit", iso: string) =>
    db.insert(transactions).values({
      userId: A.id,
      accountId: dompet.id,
      clientUuid: crypto.randomUUID(),
      amount,
      direction,
      occurredAt: new Date(iso),
      isReviewed: true,
    });

  await buat(30000n, "debit", "2026-09-05T05:00:00Z");
  await buat(20000n, "debit", "2026-09-06T05:00:00Z");
  await buat(500000n, "credit", "2026-09-07T05:00:00Z");
  // Di luar bulan: tidak boleh ikut pengeluaran September, tapi TETAP mengubah saldo.
  await buat(70000n, "debit", "2026-08-20T05:00:00Z");

  const r = await ringkasan(A.id, "2026-09");
  const dompetnya = r.accounts.find((x) => x.id === dompet.id);

  assert.equal(dompetnya?.balance, "480000", "100.000 + 500.000 − 30.000 − 20.000 − 70.000");
  assert.equal(r.month.spending, "50000", "pengeluaran September saja, tanpa yang Agustus");
  assert.equal(r.month.income, "500000");

  const belum = r.by_category.find((k) => k.id === null);
  assert.equal(belum?.total, "50000", "yang belum dikategorikan tetap ikut dihitung");

  const kosong = await ringkasan(B.id, "2026-09");
  assert.equal(kosong.month.spending, "0", "transaksi A tidak bocor ke ringkasan B");
  assert.equal(
    kosong.accounts.some((x) => x.id === dompet.id),
    false,
    "account A tidak muncul di ringkasan B",
  );
}

// --- saran kategori untuk antrian review -------------------------------------
// Antrian review meminta saran untuk seluruh halaman sekaligus. Yang dijaga di
// sini: satu penyiapan dipakai berkali-kali dan tetap memberi jawaban berbeda
// sesuai nominal masing-masing kartu.
{
  const [lain] = await db
    .insert(categories)
    .values({ userId: A.id, name: "Kopi" })
    .returning({ id: categories.id });

  // Aturan nominal persis: 25.000 -> Kopi.
  await db.insert(categoryRules).values({
    userId: A.id,
    categoryId: lain.id,
    amountMin: 25000n,
    amountMax: 25000n,
    hitCount: 9,
  });

  const saran = await pemberiSaran(A.id);
  const untuk25rb = saran(25000n, new Date());
  const untuk9jt = saran(9000000n, new Date());

  assert.equal(untuk25rb[0]?.id, lain.id, "nominal persis menang di kartu yang cocok");
  assert.notEqual(untuk9jt[0]?.id, lain.id, "kartu bernominal lain tidak ikut kena aturan itu");
  assert.ok(untuk25rb.length > 0 && untuk9jt.length > 0, "selalu ada saran, walau dari fallback");

  const kosong = await pemberiSaran(B.id);
  assert.equal(
    kosong(25000n, new Date()).some((s) => s.id === lain.id),
    false,
    "aturan milik A tidak bocor ke B",
  );

  await db.delete(categoryRules).where(eq(categoryRules.userId, A.id));
}

// --- dead letter queue ------------------------------------------------------
const NGACO = "Notifikasi promo, bukan transaksi sama sekali.";
const [ev] = await db
  .insert(inboxEvents)
  .values({
    userId: A.id,
    clientUuid: crypto.randomUUID(),
    packageName: "com.bca.mybca.omni.android",
    title: "Catatan Finansial",
    body: NGACO,
    postedAt: new Date(),
  })
  .returning({ id: inboxEvents.id, clientUuid: inboxEvents.clientUuid });

const event = { id: ev.id, userId: A.id, clientUuid: ev.clientUuid, body: NGACO, postedAt: new Date() };

for (const percobaan of [1, 2, 3]) {
  const r = await processEvent(event);
  assert.equal(r.status, "failed");
  assert.equal(
    r.status === "failed" && r.deadLettered,
    percobaan === 3,
    `masuk DLQ tepat di percobaan ke-3, bukan ke-${percobaan}`,
  );
}

assert.equal((await listDeadLetters(B.id, { limit: 50 })).length, 0, "DLQ A tidak terlihat oleh B");
const dlq = await listDeadLetters(A.id, { limit: 50 });
assert.equal(dlq.length, 1);
assert.equal(dlq[0].attempt_count, 3);
assert.equal(dlq[0].body, NGACO, "payload mentah ikut terbawa ke halaman DLQ");

assert.equal(
  await reparseDeadLetter(B.id, dlq[0].id),
  null,
  "B tidak bisa reparse dead letter milik A",
);

// Reparse yang masih gagal tidak boleh langsung masuk DLQ lagi: hitungannya
// mulai dari nol.
const lagi = await reparseDeadLetter(A.id, dlq[0].id);
assert.equal(lagi?.status, "failed");
assert.equal(lagi?.status === "failed" && lagi.deadLettered, false);

// Berdiri di tempat parser yang sudah diperbaiki: body yang tadinya tidak
// dikenali sekarang terbaca. Diwakili dengan menukar isi payload, karena
// versi parser tidak bisa diganti saat proses sedang jalan.
const BENAR = "Pengeluaran sebesar IDR 12,500.00 di kategori Belanja.";
await db.update(inboxEvents).set({ body: BENAR }).where(eq(inboxEvents.id, ev.id));

const sembuh = await reparseDeadLetter(A.id, dlq[0].id);
assert.equal(sembuh?.status, "parsed", "setelah parser diperbaiki, reparse jadi transaksi");
assert.equal(sembuh?.status === "parsed" && sembuh.amount, 12500n);

assert.equal((await listDeadLetters(A.id, { limit: 50 })).length, 0, "DLQ kosong lagi");
const arsip = await listDeadLetters(A.id, { includeResolved: true, limit: 50 });
assert.equal(arsip.length, 1, "barisnya tidak dihapus, cuma ditandai selesai");
assert.ok(arsip[0].resolved_at);

// Reparse ulang tidak boleh bikin transaksi dobel.
const ulang = await reparseDeadLetter(A.id, dlq[0].id);
assert.equal(
  ulang?.status === "parsed" && ulang.transactionId,
  sembuh?.status === "parsed" && sembuh.transactionId,
  "reparse dua kali tetap satu transaksi",
);

// --- bersih-bersih ----------------------------------------------------------
const txIds = (
  await db.select({ id: transactions.id }).from(transactions).where(inArray(transactions.userId, ids))
).map((r) => r.id);
if (txIds.length) {
  await db.delete(transactionTags).where(inArray(transactionTags.transactionId, txIds));
  await db.delete(transactions).where(inArray(transactions.id, txIds));
}
await db.delete(categoryRules).where(inArray(categoryRules.userId, ids));
await db.delete(deadLetters).where(inArray(deadLetters.userId, ids));
await db.delete(inboxEvents).where(inArray(inboxEvents.userId, ids));
await db.delete(tags).where(inArray(tags.userId, ids));
await db.delete(categories).where(inArray(categories.userId, ids));
await db.delete(accounts).where(inArray(accounts.userId, ids));
await db.delete(users).where(inArray(users.id, ids));

console.log("SEMUA PEMERIKSAAN DATABASE LULUS");
await sql.end();
