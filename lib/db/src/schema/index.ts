import {
  decimal,
  index,
  int,
  mysqlTable,
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