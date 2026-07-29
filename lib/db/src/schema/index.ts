import {
  decimal,
  index,
  int,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

export const usersTable = mysqlTable(
  "users",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    clerkId: varchar("clerk_id", { length: 255 }).notNull().unique(),
    email: varchar("email", { length: 320 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    phone: varchar("phone", { length: 40 }),
    role: varchar("role", { length: 32 }).notNull().default("user"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (table) => ({
    emailIdx: index("users_email_idx").on(table.email),
    roleIdx: index("users_role_idx").on(table.role),
  }),
);

export const walletsTable = mysqlTable("wallets", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 36 })
    .notNull()
    .unique()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  balance: decimal("balance", { precision: 18, scale: 2 }).notNull().default("0.00"),
  currency: varchar("currency", { length: 3 }).notNull().default("KES"),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

export const transactionsTable = mysqlTable(
  "transactions",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 32 }).notNull(),
    amount: decimal("amount", { precision: 18, scale: 2 }).notNull(),
    balanceAfter: decimal("balance_after", { precision: 18, scale: 2 }).notNull(),
    reference: varchar("reference", { length: 120 }),
    description: varchar("description", { length: 255 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    userCreatedIdx: index("transactions_user_created_idx").on(
      table.userId,
      table.createdAt,
    ),
  }),
);

export const roundsTable = mysqlTable(
  "rounds",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    crashPoint: decimal("crash_point", { precision: 10, scale: 2 }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("completed"),
    startedAt: timestamp("started_at").notNull().defaultNow(),
    endedAt: timestamp("ended_at"),
  },
  (table) => ({
    statusIdx: index("rounds_status_idx").on(table.status),
  }),
);

export const betsTable = mysqlTable(
  "bets",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    roundId: varchar("round_id", { length: 36 }).notNull(),
    amount: decimal("amount", { precision: 18, scale: 2 }).notNull(),
    cashoutMultiplier: decimal("cashout_multiplier", {
      precision: 10,
      scale: 2,
    }),
    payout: decimal("payout", { precision: 18, scale: 2 }),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    settledAt: timestamp("settled_at"),
  },
  (table) => ({
    userCreatedIdx: index("bets_user_created_idx").on(
      table.userId,
      table.createdAt,
    ),
    roundIdx: index("bets_round_idx").on(table.roundId),
  }),
);

// ── Deposits ──────────────────────────────────────────────────────────────────
// Tracks money coming INTO a user's wallet (M-PESA, bank transfer, etc.).
// Workflow: user initiates → status=pending → payment provider confirms → status=completed
// → balance is credited and a transaction record is written.
export const depositsTable = mysqlTable(
  "deposits",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    amount: decimal("amount", { precision: 18, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("KES"),
    // Payment method: mpesa | bank | card | manual
    method: varchar("method", { length: 32 }).notNull().default("mpesa"),
    // pending | completed | failed | cancelled
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    // Provider-side reference (e.g. M-PESA confirmation code)
    providerRef: varchar("provider_ref", { length: 120 }),
    // Phone number used for M-PESA push
    phone: varchar("phone", { length: 40 }),
    // Admin or system notes
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    completedAt: timestamp("completed_at"),
  },
  (table) => ({
    userStatusIdx: index("deposits_user_status_idx").on(table.userId, table.status),
    providerRefIdx: index("deposits_provider_ref_idx").on(table.providerRef),
    statusIdx: index("deposits_status_idx").on(table.status),
  }),
);

// ── Withdrawals ───────────────────────────────────────────────────────────────
// Tracks money going OUT of a user's wallet (M-PESA, bank transfer, etc.).
// Workflow: user requests → balance held (status=pending) → admin/system approves
// → payment sent (status=processing) → confirmed (status=completed)
// OR rejected (status=rejected) → balance restored.
export const withdrawalsTable = mysqlTable(
  "withdrawals",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    amount: decimal("amount", { precision: 18, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("KES"),
    // Payment method: mpesa | bank | manual
    method: varchar("method", { length: 32 }).notNull().default("mpesa"),
    // pending | processing | completed | rejected | cancelled
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    // Destination details (phone for M-PESA, account number for bank, etc.)
    accountDetails: varchar("account_details", { length: 255 }),
    // Phone number for M-PESA
    phone: varchar("phone", { length: 40 }),
    // Provider-side reference (e.g. M-PESA confirmation code after payment)
    providerRef: varchar("provider_ref", { length: 120 }),
    // Admin or system notes (reason for rejection, etc.)
    notes: text("notes"),
    // ID of admin who processed this withdrawal
    processedBy: varchar("processed_by", { length: 36 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    processedAt: timestamp("processed_at"),
  },
  (table) => ({
    userStatusIdx: index("withdrawals_user_status_idx").on(table.userId, table.status),
    statusIdx: index("withdrawals_status_idx").on(table.status),
    providerRefIdx: index("withdrawals_provider_ref_idx").on(table.providerRef),
  }),
);
