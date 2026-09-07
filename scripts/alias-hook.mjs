// Menerjemahkan alias "@/..." (tsconfig paths) ke path berkas, supaya modul di
// backend/ bisa dijalankan langsung oleh node tanpa bundler. Dipakai pengecekan
// yang memang butuh database sungguhan; unit test murni tidak perlu ini.
// Akar proyek: berkas ini ada di <root>/scripts/.
const root = new URL("../", import.meta.url).href;

export async function resolve(specifier, context, next) {
  if (!specifier.startsWith("@/")) return next(specifier, context);

  const base = new URL(specifier.slice(2), root).href;
  if (base.endsWith(".ts")) return next(base, context);
  // "@/backend/db" bisa berarti db.ts atau db/index.ts.
  try {
    return await next(`${base}.ts`, context);
  } catch {
    return next(`${base}/index.ts`, context);
  }
}
