import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL belum diisi. Lihat .env.example");

// Wajib untuk Supabase transaction pooler (port 6543):
// pool kecil karena sudah di belakang pooler, prepared statements tidak didukung.
const client = postgres(url, { max: 1, prepare: false, connect_timeout: 10 });

export const db = drizzle(client);
export { client as sql };
