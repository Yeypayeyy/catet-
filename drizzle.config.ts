import type { Config } from "drizzle-kit";

export default {
  schema: "./backend/db/schema.ts",
  out: "./backend/db/migrations",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
} satisfies Config;
