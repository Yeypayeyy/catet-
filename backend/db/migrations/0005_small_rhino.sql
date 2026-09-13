CREATE TYPE "public"."category_kind" AS ENUM('expense', 'income');--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "kind" "category_kind" DEFAULT 'expense' NOT NULL;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "is_default" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "hidden_at" timestamp with time zone;
--> statement-breakpoint
-- Kategori lama bernama sama dengan bawaan: tandai bawaan, isi jenis dan
-- urutannya. Daftar ini salinan DEFAULT_CATEGORIES di backend/db/defaults.ts.
-- Kategori pemasukan tambahan (Hadiah, Pemasukan Lain) sengaja TIDAK
-- disuntikkan ke user lama.
UPDATE "categories" AS c
SET "is_default" = true, "kind" = d.kind::category_kind, "sort_order" = d.urutan
FROM (VALUES
  ('Makan & Minum', 'expense', 0),
  ('Jajan', 'expense', 1),
  ('Belanja Harian', 'expense', 2),
  ('Transport', 'expense', 3),
  ('Bensin', 'expense', 4),
  ('Pulsa & Internet', 'expense', 5),
  ('Listrik & Air', 'expense', 6),
  ('Sewa & Kos', 'expense', 7),
  ('Kesehatan', 'expense', 8),
  ('Pendidikan', 'expense', 9),
  ('Hiburan', 'expense', 10),
  ('Olahraga', 'expense', 11),
  ('Donasi', 'expense', 12),
  ('Transfer', 'expense', 13),
  ('Gaji', 'income', 0),
  ('Hadiah', 'income', 1),
  ('Pemasukan Lain', 'income', 2)
) AS d(name, kind, urutan)
WHERE c."name" = d.name;
--> statement-breakpoint
-- Kategori buatan sendiri: di belakang bawaan, per user dan jenis, urut nama.
UPDATE "categories" AS c
SET "sort_order" = 100 + x.n
FROM (
  SELECT "id", row_number() OVER (PARTITION BY "user_id", "kind" ORDER BY "name") AS n
  FROM "categories"
  WHERE "is_default" = false
) AS x
WHERE c."id" = x."id";
