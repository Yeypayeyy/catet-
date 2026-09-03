import type { Config } from "drizzle-kit";

// drizzle-kit tidak memuat .env sendiri. process.loadEnvFile bawaan Node,
// tanpa dependency tambahan. Di Vercel tidak ada file .env, jadi diabaikan.
try {
  process.loadEnvFile();
} catch {
  // env sudah disuntik lingkungan
}

export default {
  schema: "./backend/db/schema.ts",
  out: "./backend/db/migrations",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
} satisfies Config;
