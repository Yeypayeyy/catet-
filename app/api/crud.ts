// Pabrik route handler untuk empat resource referensi. Bukan route (tidak
// bernama route.ts), cuma modul bantu di lapisan HTTP.
//
// Tiap resource cuma menyumbang: skema Zod, pemetaan body ke kolom, dan
// pemetaan baris ke JSON. Sisanya — auth, validasi, 404, bentuk error —
// dikerjakan sekali di sini.
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/backend/db";
import { categories } from "@/backend/db/schema";
import {
  CATALOG,
  createOwned,
  listOwned,
  softDeleteOwned,
  updateOwned,
} from "@/backend/services/catalog";
import { currentUserId, fail } from "@/app/api/session";

type Resource = keyof typeof CATALOG;
type Row = Record<string, unknown>;

export type CrudSpec<TBody> = {
  resource: Resource;
  body: z.ZodType<TBody>;
  /** Body (snake_case) -> kolom tabel (camelCase). Kunci undefined tidak diubah. */
  toColumns: (body: TBody) => Record<string, unknown>;
  toJson: (row: Row) => unknown;
  /** Cek relasi milik user sendiri. Kembalikan pesan kalau ditolak. */
  check?: (userId: string, body: TBody) => Promise<string | null>;
};

/** Relasi ke kategori (parent_id, default_category_id) harus milik user yang sama. */
export async function ownsCategory(userId: string, id: string | null | undefined) {
  if (!id) return true;
  const [row] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.id, id), eq(categories.userId, userId), isNull(categories.deletedAt)))
    .limit(1);
  return Boolean(row);
}

async function readBody<T>(request: Request, schema: z.ZodType<T>, partial: boolean) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { error: fail(400, "INVALID_JSON", "Body bukan JSON yang valid") };
  }
  const s = partial ? (schema as unknown as z.ZodObject).partial() : schema;
  const parsed = s.safeParse(raw);
  if (!parsed.success) return { error: fail(400, "INVALID_BODY", z.prettifyError(parsed.error)) };
  return { data: parsed.data as T };
}

/** GET (daftar) + POST (buat) untuk /api/<resource>. */
export function collectionRoutes<T>(spec: CrudSpec<T>) {
  const { table, columns, orderBy } = CATALOG[spec.resource];

  return {
    async GET() {
      const userId = await currentUserId();
      if (!userId) return fail(401, "UNAUTHORIZED", "Butuh session yang valid");
      const rows = await listOwned(table, columns, userId, orderBy);
      return Response.json({ items: rows.map(spec.toJson) });
    },

    async POST(request: Request) {
      const userId = await currentUserId();
      if (!userId) return fail(401, "UNAUTHORIZED", "Butuh session yang valid");

      const body = await readBody(request, spec.body, false);
      if ("error" in body) return body.error;

      const problem = await spec.check?.(userId, body.data);
      if (problem) return fail(404, "NOT_FOUND", problem);

      const row = await createOwned(table, columns, userId, spec.toColumns(body.data));
      return Response.json(spec.toJson(row), { status: 201 });
    },
  };
}

/** PATCH + DELETE untuk /api/<resource>/:id. */
export function itemRoutes<T>(spec: CrudSpec<T>) {
  const { table, columns } = CATALOG[spec.resource];
  const notFound = () => fail(404, "NOT_FOUND", "Tidak ditemukan");

  return {
    async PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
      const userId = await currentUserId();
      if (!userId) return fail(401, "UNAUTHORIZED", "Butuh session yang valid");

      const { id } = await params;
      if (!z.uuid().safeParse(id).success) return notFound();

      const body = await readBody(request, spec.body, true);
      if ("error" in body) return body.error;

      const problem = await spec.check?.(userId, body.data);
      if (problem) return fail(404, "NOT_FOUND", problem);

      const values = spec.toColumns(body.data);
      // Kunci bernilai undefined dibuang, kalau tidak drizzle menulis NULL.
      for (const k of Object.keys(values)) if (values[k] === undefined) delete values[k];
      if (Object.keys(values).length === 0) {
        return fail(400, "INVALID_BODY", "Tidak ada yang diubah");
      }

      const row = await updateOwned(table, columns, userId, id, values);
      // Milik user lain dijawab 404, bukan 403: keberadaannya pun tidak dibocorkan.
      return row ? Response.json(spec.toJson(row)) : notFound();
    },

    async DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
      const userId = await currentUserId();
      if (!userId) return fail(401, "UNAUTHORIZED", "Butuh session yang valid");

      const { id } = await params;
      if (!z.uuid().safeParse(id).success) return notFound();

      return (await softDeleteOwned(table, userId, id))
        ? new Response(null, { status: 204 })
        : notFound();
    },
  };
}
