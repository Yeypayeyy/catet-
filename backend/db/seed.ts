// Seed data demo. Idempoten: aman dijalankan berulang.
// Jalankan: pnpm db:seed
import { eq } from "drizzle-orm";
import { db, sql } from "./index.ts";
import { accounts, categories, users } from "./schema.ts";

const DEMO_EMAIL = "demo@catet.local";

const ACCOUNTS = [
  { name: "myBCA", kind: "bank" as const, initBalance: 0n },
  { name: "Cash", kind: "cash" as const, initBalance: 0n },
  { name: "GoPay", kind: "ewallet" as const, initBalance: 0n },
];

const CATEGORIES = [
  "Makan & Minum",
  "Jajan",
  "Belanja Harian",
  "Transport",
  "Bensin",
  "Pulsa & Internet",
  "Listrik & Air",
  "Sewa & Kos",
  "Kesehatan",
  "Pendidikan",
  "Hiburan",
  "Olahraga",
  "Donasi",
  "Transfer",
  "Gaji",
];

async function main() {
  const [user] = await db
    .insert(users)
    .values({ email: DEMO_EMAIL, name: "Demo" })
    .onConflictDoUpdate({ target: users.email, set: { name: "Demo" } })
    .returning();

  const existingAccounts = await db
    .select({ name: accounts.name })
    .from(accounts)
    .where(eq(accounts.userId, user.id));
  const haveAccount = new Set(existingAccounts.map((a) => a.name));
  const newAccounts = ACCOUNTS.filter((a) => !haveAccount.has(a.name));
  if (newAccounts.length) {
    await db.insert(accounts).values(newAccounts.map((a) => ({ ...a, userId: user.id })));
  }

  const existingCategories = await db
    .select({ name: categories.name })
    .from(categories)
    .where(eq(categories.userId, user.id));
  const haveCategory = new Set(existingCategories.map((c) => c.name));
  const newCategories = CATEGORIES.filter((c) => !haveCategory.has(c));
  if (newCategories.length) {
    await db.insert(categories).values(newCategories.map((name) => ({ name, userId: user.id })));
  }

  console.log(
    `seed ok: user=${user.email} accounts+${newAccounts.length} categories+${newCategories.length}`,
  );
  await sql.end();
}

main().catch(async (e) => {
  console.error(e);
  await sql.end();
  process.exit(1);
});
