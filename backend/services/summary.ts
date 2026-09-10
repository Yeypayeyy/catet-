// Angka ringkasan untuk layar Ringkasan.
//
// Saldo TIDAK pernah disimpan sebagai kolom. Selalu dihitung dari saldo awal
// account ditambah seluruh transaksinya — saldo yang disimpan akan menyimpang
// dari transaksinya cepat atau lambat, dan menyimpangnya diam-diam.
import { and, desc, eq, gte, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/backend/db";
import { accounts, categories, transactions } from "@/backend/db/schema";

// WIB tidak punya DST. Bulan berjalan dihitung menurut jam Jakarta, bukan UTC,
// supaya transaksi jam 7 pagi tanggal 1 tidak jatuh ke bulan sebelumnya.
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

export type Ringkasan = {
  balance: string;
  accounts: { id: string; name: string; balance: string }[];
  month: { key: string; label: string; spending: string; income: string; days: number };
  by_category: { id: string | null; name: string; total: string }[];
  pending_count: number;
};

const NAMA_BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

/** Batas bulan menurut WIB, dikembalikan sebagai waktu UTC untuk query. */
export function batasBulan(key?: string, sekarang = new Date()) {
  const wib = new Date(sekarang.getTime() + WIB_OFFSET_MS);
  const tahun = key ? Number(key.slice(0, 4)) : wib.getUTCFullYear();
  const bulan = key ? Number(key.slice(5, 7)) - 1 : wib.getUTCMonth();

  const awal = new Date(Date.UTC(tahun, bulan, 1) - WIB_OFFSET_MS);
  const akhir = new Date(Date.UTC(tahun, bulan + 1, 1) - WIB_OFFSET_MS);

  // Berapa hari bulan ini sudah berjalan; untuk bulan lampau, sebulan penuh.
  const habis = sekarang >= akhir;
  const hari = habis
    ? new Date(Date.UTC(tahun, bulan + 1, 0)).getUTCDate()
    : Math.max(1, wib.getUTCDate());

  return {
    key: `${tahun}-${String(bulan + 1).padStart(2, "0")}`,
    label: `${NAMA_BULAN[bulan]}${tahun === wib.getUTCFullYear() ? "" : ` ${tahun}`}`,
    awal,
    akhir,
    hari,
  };
}

export async function ringkasan(userId: string, monthKey?: string): Promise<Ringkasan> {
  const bulan = batasBulan(monthKey);

  const barisSaldo = await db
    .select({
      id: accounts.id,
      name: accounts.name,
      init: accounts.initBalance,
      masuk: sql<string>`coalesce(sum(case when ${transactions.direction} = 'credit' then ${transactions.amount} else 0 end), 0)`,
      keluar: sql<string>`coalesce(sum(case when ${transactions.direction} = 'debit' then ${transactions.amount} else 0 end), 0)`,
    })
    .from(accounts)
    .leftJoin(
      transactions,
      and(
        eq(transactions.accountId, accounts.id),
        eq(transactions.userId, userId),
        isNull(transactions.deletedAt),
      ),
    )
    .where(and(eq(accounts.userId, userId), isNull(accounts.deletedAt)))
    .groupBy(accounts.id, accounts.name, accounts.initBalance, accounts.createdAt)
    .orderBy(accounts.createdAt);

  const daftarAccount = barisSaldo.map((a) => ({
    id: a.id,
    name: a.name,
    balance: (a.init + BigInt(a.masuk) - BigInt(a.keluar)).toString(),
  }));
  const total = daftarAccount.reduce((a, x) => a + BigInt(x.balance), 0n);

  const dalamBulan = and(
    eq(transactions.userId, userId),
    isNull(transactions.deletedAt),
    gte(transactions.occurredAt, bulan.awal),
    lt(transactions.occurredAt, bulan.akhir),
  );

  const [arah] = await db
    .select({
      keluar: sql<string>`coalesce(sum(case when ${transactions.direction} = 'debit' then ${transactions.amount} else 0 end), 0)`,
      masuk: sql<string>`coalesce(sum(case when ${transactions.direction} = 'credit' then ${transactions.amount} else 0 end), 0)`,
    })
    .from(transactions)
    .where(dalamBulan);

  // Pengeluaran per kategori. Yang belum dikategorikan tetap ikut dihitung —
  // menyembunyikannya bikin jumlah di kartu tidak cocok dengan totalnya.
  const perKategori = await db
    .select({
      id: categories.id,
      name: categories.name,
      total: sql<string>`sum(${transactions.amount})`,
    })
    .from(transactions)
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .where(and(dalamBulan, eq(transactions.direction, "debit")))
    .groupBy(categories.id, categories.name)
    .orderBy(desc(sql`sum(${transactions.amount})`));

  const [{ menunggu }] = await db
    .select({ menunggu: sql<string>`count(*)` })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        isNull(transactions.deletedAt),
        eq(transactions.isReviewed, false),
      ),
    );

  return {
    balance: total.toString(),
    accounts: daftarAccount,
    month: {
      key: bulan.key,
      label: bulan.label,
      spending: BigInt(arah?.keluar ?? 0).toString(),
      income: BigInt(arah?.masuk ?? 0).toString(),
      days: bulan.hari,
    },
    by_category: perKategori.map((k) => ({
      id: k.id,
      name: k.name ?? "Belum dikategorikan",
      total: BigInt(k.total).toString(),
    })),
    pending_count: Number(menunggu ?? 0),
  };
}
