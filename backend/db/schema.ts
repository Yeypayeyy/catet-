import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

// Kolom yang dimiliki semua tabel. Soft delete: deleted_at, jangan hard delete.
const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
};

export const directionEnum = pgEnum("direction", ["debit", "credit"]);
export const parseStatusEnum = pgEnum("parse_status", ["pending", "parsed", "failed"]);
export const accountKindEnum = pgEnum("account_kind", ["bank", "cash", "ewallet"]);
export const txSourceEnum = pgEnum("tx_source", ["notification", "manual"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  ...timestamps,
});

export const devices = pgTable("devices", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  // Hash saja, tidak pernah plaintext. Token ditampilkan sekali saat dibuat.
  tokenHash: text("token_hash").notNull().unique(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  ...timestamps,
});

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  kind: accountKindEnum("kind").notNull(),
  // Satuan minor. 10000 = Rp10.000. Saldo berjalan dihitung dari sini + transaksi,
  // tidak pernah disimpan sebagai cache (lihat PRD bagian 5).
  initBalance: bigint("init_balance", { mode: "bigint" }).notNull().default(sql`0`),
  ...timestamps,
});

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  parentId: uuid("parent_id").references((): AnyPgColumn => categories.id),
  ...timestamps,
});

// Payload mentah dari device, disimpan APA ADANYA sebelum parsing. Selalu.
export const inboxEvents = pgTable(
  "inbox_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    deviceId: uuid("device_id").references(() => devices.id),
    clientUuid: uuid("client_uuid").notNull(),
    packageName: text("package_name").notNull(),
    title: text("title"),
    body: text("body").notNull(),
    // Waktu notifikasi muncul di device (epoch ms dari Android).
    postedAt: timestamp("posted_at", { withTimezone: true }).notNull(),
    parseStatus: parseStatusEnum("parse_status").notNull().default("pending"),
    parserVersion: integer("parser_version"),
    attemptCount: integer("attempt_count").notNull().default(0),
    lastError: text("last_error"),
    ...timestamps,
  },
  (t) => [uniqueIndex("inbox_events_client_uuid_uniq").on(t.clientUuid)],
);

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id),
    categoryId: uuid("category_id").references(() => categories.id),
    inboxEventId: uuid("inbox_event_id").references(() => inboxEvents.id),
    // Idempotency: dibuat di device, dipakai untuk dedupe saat retry.
    clientUuid: uuid("client_uuid").notNull(),
    // Satuan minor, selalu positif. Arah ada di kolom direction.
    amount: bigint("amount", { mode: "bigint" }).notNull(),
    direction: directionEnum("direction").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    note: text("note"),
    merchant: text("merchant"),
    // Kategori dari BCA disimpan sebagai arsip, tidak dipakai untuk kategorisasi.
    bankCategory: text("bank_category"),
    source: txSourceEnum("source").notNull().default("notification"),
    isReviewed: boolean("is_reviewed").notNull().default(false),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("transactions_client_uuid_uniq").on(t.clientUuid),
    index("transactions_user_occurred_idx").on(t.userId, t.occurredAt),
    index("transactions_user_reviewed_idx").on(t.userId, t.isReviewed),
  ],
);
