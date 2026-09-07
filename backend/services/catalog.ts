// CRUD untuk empat tabel referensi yang bentuknya sama persis: categories,
// accounts, merchants, tags. Semuanya milik satu user, semuanya soft delete,
// semuanya cuma beda di kolom isinya.
//
// Satu helper generik, empat deskriptor. Menulis empat modul yang isinya sama
// cuma beda nama tabel adalah cara paling rapi untuk membuat tiga di antaranya
// ketinggalan perbaikan bug.
import { and, asc, eq, isNull, type SQL } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { db } from "@/backend/db";
import { accounts, categories, merchants, tags } from "@/backend/db/schema";

type OwnedTable = PgTable & {
  id: PgColumn;
  userId: PgColumn;
  deletedAt: PgColumn;
};

const alive = (table: OwnedTable, userId: string): SQL =>
  and(eq(table.userId, userId), isNull(table.deletedAt)) as SQL;

/**
 * Baris milik user, urut sesuai `orderBy`. Tidak pernah bocor milik user lain.
 *
 * Cast di akhir karena tabelnya generik: drizzle tidak bisa menyimpulkan bentuk
 * baris dari `columns` yang tipenya baru diketahui saat dipanggil. Bentuk
 * sebenarnya ditegakkan di CATALOG dan di pemetaan JSON tiap route.
 */
export async function listOwned(
  table: OwnedTable,
  columns: Record<string, PgColumn>,
  userId: string,
  orderBy: PgColumn,
): Promise<Record<string, unknown>[]> {
  const rows = await db
    .select(columns)
    .from(table)
    .where(alive(table, userId))
    .orderBy(asc(orderBy));
  return rows as Record<string, unknown>[];
}

export async function createOwned(
  table: OwnedTable,
  columns: Record<string, PgColumn>,
  userId: string,
  values: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const [row] = await db
    .insert(table)
    .values({ ...values, userId })
    .returning(columns);
  return row as Record<string, unknown>;
}

/** null = tidak ada / milik user lain. Keduanya dijawab 404 di lapisan HTTP. */
export async function updateOwned(
  table: OwnedTable,
  columns: Record<string, PgColumn>,
  userId: string,
  id: string,
  values: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  const [row] = await db
    .update(table)
    .set({ ...values, updatedAt: new Date() })
    .where(and(eq(table.id, id), alive(table, userId)))
    .returning(columns);
  return (row as Record<string, unknown>) ?? null;
}

export async function softDeleteOwned(
  table: OwnedTable,
  userId: string,
  id: string,
): Promise<boolean> {
  const rows = await db
    .update(table)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(table.id, id), alive(table, userId)))
    .returning({ id: table.id });
  return rows.length > 0;
}

// Kolom yang dikembalikan ke klien. initBalance sengaja tidak ada di sini —
// bigint tidak boleh lewat JSON.stringify apa adanya, jadi dipetakan manual.
export const CATALOG = {
  categories: {
    table: categories as OwnedTable,
    columns: { id: categories.id, name: categories.name, parentId: categories.parentId },
    orderBy: categories.name,
  },
  accounts: {
    table: accounts as OwnedTable,
    columns: {
      id: accounts.id,
      name: accounts.name,
      kind: accounts.kind,
      initBalance: accounts.initBalance,
    },
    orderBy: accounts.name,
  },
  merchants: {
    table: merchants as OwnedTable,
    columns: {
      id: merchants.id,
      name: merchants.name,
      defaultCategoryId: merchants.defaultCategoryId,
    },
    orderBy: merchants.name,
  },
  tags: {
    table: tags as OwnedTable,
    columns: { id: tags.id, name: tags.name },
    orderBy: tags.name,
  },
} as const;
