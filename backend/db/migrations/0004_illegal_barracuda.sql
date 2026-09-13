ALTER TABLE "categories" ADD COLUMN "icon" text;
--> statement-breakpoint
-- Kategori lama bernama persis sama dengan default ikut dapat ikonnya.
-- Kategori buatan sendiri dan yang sudah punya ikon tidak disentuh.
-- Daftar ini salinan DEFAULT_CATEGORIES di backend/db/defaults.ts.
UPDATE "categories" AS c SET "icon" = d.icon
FROM (VALUES
  ('Makan & Minum', '🍜'),
  ('Jajan', '🍩'),
  ('Belanja Harian', '🛒'),
  ('Transport', '🚌'),
  ('Bensin', '⛽'),
  ('Pulsa & Internet', '📶'),
  ('Listrik & Air', '💡'),
  ('Sewa & Kos', '🏠'),
  ('Kesehatan', '💊'),
  ('Pendidikan', '🎓'),
  ('Hiburan', '🎬'),
  ('Olahraga', '⚽'),
  ('Donasi', '🤲'),
  ('Transfer', '🔁'),
  ('Gaji', '💰')
) AS d(name, icon)
WHERE c."name" = d.name AND c."icon" IS NULL;
