// Reparse batch seluruh inbox_events yang belum jadi transaksi, dengan parser
// versi sekarang. Jalankan setelah parser diperbaiki: pnpm reparse
//
// Aman diulang — event yang sudah jadi transaksi dilewati, dan pembuatan
// transaksi tetap idempoten lewat client_uuid.
import { sql } from "@/backend/db";
import { reparseAll } from "@/backend/services/inbox";

const userId = process.argv[2];
const hasil = await reparseAll({ userId });
console.log(
  `reparse selesai: ${hasil.total} event diproses, ${hasil.parsed} jadi transaksi, ${hasil.failed} masih gagal`,
);
await sql.end();
