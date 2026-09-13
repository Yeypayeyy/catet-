// Saran catatan: catatan yang pernah diketik, supaya tidak mengetik ulang
// "Sop Pak Samson" setiap kali.
import { and, desc, eq, gte, isNull, sql, type SQL } from "drizzle-orm";
import { db } from "@/backend/db";
import { transactions } from "@/backend/db/schema";
import { escapeLike } from "@/backend/services/notes-like";

const HARI_90_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * Maksimal 8 catatan dari 90 hari terakhir. Kalau kategori sudah dipilih,
 * catatan yang pernah dipakai dengan kategori itu naik ke atas dan sisanya
 * menambal — kategori yang jarang dipakai tetap dapat saran.
 */
export async function noteSuggestions(
  userId: string,
  opts: { categoryId?: string; q?: string },
): Promise<string[]> {
  const catatan = sql<string>`btrim(${transactions.note})`;

  const where: SQL[] = [
    eq(transactions.userId, userId),
    isNull(transactions.deletedAt),
    gte(transactions.occurredAt, new Date(Date.now() - HARI_90_MS)),
    sql`${catatan} <> ''`,
  ];
  if (opts.q) {
    // Backslash sudah jadi karakter escape bawaan ILIKE di Postgres; ditulis
    // eksplisit supaya tidak bergantung pada setelan standard_conforming_strings.
    where.push(sql`${transactions.note} ilike ${`%${escapeLike(opts.q)}%`} escape ${"\\"}`);
  }

  const urutan: SQL[] = [];
  if (opts.categoryId) {
    urutan.push(desc(sql`bool_or(${transactions.categoryId} = ${opts.categoryId})`));
  }
  urutan.push(desc(sql`count(*)`), desc(sql`max(${transactions.occurredAt})`));

  const rows = await db
    .select({ note: catatan })
    .from(transactions)
    .where(and(...where))
    .groupBy(catatan)
    .orderBy(...urutan)
    .limit(8);

  return rows.map((r) => r.note);
}
