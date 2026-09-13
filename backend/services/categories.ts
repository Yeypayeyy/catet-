// Kategori: bawaan + buatan sendiri, dipisah per jenis, dengan urutan manual.
//
// Tidak lewat pabrik CRUD generik (catalog.ts) lagi: `kind` wajib saat dibuat
// tapi tidak boleh diubah, `sort_order` dihitung di sini, dan kategori bawaan
// disembunyikan alih-alih dihapus. Tiga pengecualian itu lebih jujur ditulis
// langsung daripada diselipkan sebagai kait ke pabriknya.
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/backend/db";
import { categories } from "@/backend/db/schema";

export type CategoryKind = "expense" | "income";

export type CategoryJson = {
  id: string;
  name: string;
  icon: string | null;
  kind: CategoryKind;
  sort_order: number;
  is_default: boolean;
  hidden: boolean;
  parent_id: string | null;
};

const COLUMNS = {
  id: categories.id,
  name: categories.name,
  icon: categories.icon,
  kind: categories.kind,
  sortOrder: categories.sortOrder,
  isDefault: categories.isDefault,
  hiddenAt: categories.hiddenAt,
  parentId: categories.parentId,
};

type Row = {
  id: string;
  name: string;
  icon: string | null;
  kind: CategoryKind;
  sortOrder: number;
  isDefault: boolean;
  hiddenAt: Date | null;
  parentId: string | null;
};

const toJson = (r: Row): CategoryJson => ({
  id: r.id,
  name: r.name,
  icon: r.icon,
  kind: r.kind,
  sort_order: r.sortOrder,
  is_default: r.isDefault,
  hidden: r.hiddenAt !== null,
  parent_id: r.parentId,
});

const milik = (userId: string, id: string) =>
  and(eq(categories.id, id), eq(categories.userId, userId), isNull(categories.deletedAt));

/** Termasuk yang disembunyikan: label transaksi lama tetap butuh namanya. */
export async function listCategories(userId: string): Promise<CategoryJson[]> {
  const rows = await db
    .select(COLUMNS)
    .from(categories)
    .where(and(eq(categories.userId, userId), isNull(categories.deletedAt)))
    .orderBy(asc(categories.kind), asc(categories.sortOrder), asc(categories.name));
  return rows.map(toJson);
}

/** Selalu buatan sendiri, selalu di urutan paling bawah jenisnya. */
export async function createCategory(
  userId: string,
  input: { name: string; icon: string | null; kind: CategoryKind },
): Promise<CategoryJson> {
  const [row] = await db
    .insert(categories)
    .values({
      userId,
      name: input.name,
      icon: input.icon,
      kind: input.kind,
      isDefault: false,
      sortOrder: sql`(
        select coalesce(max(${categories.sortOrder}), -1) + 1 from ${categories}
        where ${categories.userId} = ${userId} and ${categories.kind} = ${input.kind}
          and ${categories.deletedAt} is null
      )`,
    })
    .returning(COLUMNS);
  return toJson(row);
}

/** null = tidak ada / milik user lain. `kind` sengaja tidak bisa diubah. */
export async function updateCategory(
  userId: string,
  id: string,
  input: { name?: string; icon?: string | null; hidden?: boolean },
): Promise<CategoryJson | null> {
  const [row] = await db
    .update(categories)
    .set({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.icon !== undefined && { icon: input.icon }),
      ...(input.hidden !== undefined && { hiddenAt: input.hidden ? new Date() : null }),
      updatedAt: new Date(),
    })
    .where(milik(userId, id))
    .returning(COLUMNS);
  return row ? toJson(row) : null;
}

/** Soft delete. Kategori bawaan ditolak — yang itu disembunyikan. */
export async function deleteCategory(
  userId: string,
  id: string,
): Promise<"ok" | "not_found" | "default"> {
  const [row] = await db
    .select({ isDefault: categories.isDefault })
    .from(categories)
    .where(milik(userId, id))
    .limit(1);
  if (!row) return "not_found";
  if (row.isDefault) return "default";

  await db
    .update(categories)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(milik(userId, id));
  return "ok";
}

/**
 * Simpan urutan satu jenis: sort_order = posisi di `ids`. Semua id wajib milik
 * user, belum dihapus, dan berjenis sama — kalau satu saja tidak, tidak ada
 * yang diubah.
 */
export async function reorderCategories(
  userId: string,
  kind: CategoryKind,
  ids: string[],
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const cocok = await tx
      .select({ id: categories.id })
      .from(categories)
      .where(
        and(
          inArray(categories.id, ids),
          eq(categories.userId, userId),
          eq(categories.kind, kind),
          isNull(categories.deletedAt),
        ),
      );
    if (cocok.length !== ids.length) return false;

    const nilai = sql.join(
      ids.map((id, i) => sql`(${id}::uuid, ${i}::int)`),
      sql`, `,
    );
    await tx.execute(sql`
      update ${categories} as c
      set sort_order = v.urutan, updated_at = now()
      from (values ${nilai}) as v(id, urutan)
      where c.id = v.id and c.user_id = ${userId}
    `);
    return true;
  });
}
