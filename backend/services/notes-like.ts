// Bagian murni dari saran catatan: tanpa import database, supaya bisa diuji
// dengan `node --test` saja.

/** Ketikan user dipakai di ILIKE: `\`, `%`, dan `_` harus jadi karakter biasa. */
export function escapeLike(teks: string): string {
  return teks.replace(/[\\%_]/g, (c) => `\\${c}`);
}
