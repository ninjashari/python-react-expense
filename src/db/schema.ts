import {
  pgTable,
  uuid,
  varchar,
  text,
  numeric,
  integer,
  date,
  timestamp,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const accountTypeEnum = pgEnum("account_type", [
  "checking",
  "savings",
  "credit",
  "cash",
  "investment",
  "ppf",
]);

export const accountStatusEnum = pgEnum("account_status", [
  "active",
  "inactive",
  "closed",
]);

export const transactionTypeEnum = pgEnum("transaction_type", [
  "income",
  "expense",
  "transfer",
]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    type: accountTypeEnum("type").notNull(),
    openingBalance: numeric("opening_balance", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    balance: numeric("balance", { precision: 14, scale: 2 }).notNull().default("0"),
    accountNumber: varchar("account_number", { length: 64 }),
    cardNumber: varchar("card_number", { length: 4 }),
    cardExpiryMonth: integer("card_expiry_month"),
    cardExpiryYear: integer("card_expiry_year"),
    creditLimit: numeric("credit_limit", { precision: 14, scale: 2 }),
    billGenerationDate: integer("bill_generation_date"),
    paymentDueDate: integer("payment_due_date"),
    interestRate: numeric("interest_rate", { precision: 6, scale: 3 }),
    status: accountStatusEnum("status").notNull().default("active"),
    openingDate: date("opening_date"),
    currency: varchar("currency", { length: 3 }).notNull().default("INR"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("accounts_user_idx").on(t.userId)],
);

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    slug: varchar("slug", { length: 140 }).notNull(),
    color: varchar("color", { length: 9 }).notNull().default("#6366f1"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("categories_user_slug_idx").on(t.userId, t.slug)],
);

export const payees = pgTable(
  "payees",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 160 }).notNull(),
    slug: varchar("slug", { length: 180 }).notNull(),
    color: varchar("color", { length: 9 }).notNull().default("#10b981"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("payees_user_slug_idx").on(t.userId, t.slug)],
);

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    toAccountId: uuid("to_account_id").references(() => accounts.id, {
      onDelete: "set null",
    }),
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    payeeId: uuid("payee_id").references(() => payees.id, { onDelete: "set null" }),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    type: transactionTypeEnum("type").notNull(),
    description: text("description"),
    notes: text("notes"),
    date: date("date").notNull(),
    rewardPoints: numeric("reward_points", { precision: 12, scale: 2 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("transactions_user_date_idx").on(t.userId, t.date),
    index("transactions_account_idx").on(t.accountId),
    index("transactions_category_idx").on(t.categoryId),
    index("transactions_payee_idx").on(t.payeeId),
  ],
);

export const rewardRedemptions = pgTable(
  "reward_redemptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    points: numeric("points", { precision: 12, scale: 2 }).notNull(),
    description: text("description"),
    date: date("date").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("reward_redemptions_user_idx").on(t.userId),
    index("reward_redemptions_account_idx").on(t.accountId),
  ],
);

export const rewardBonuses = pgTable(
  "reward_bonuses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    points: numeric("points", { precision: 12, scale: 2 }).notNull(),
    description: text("description"),
    date: date("date").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("reward_bonuses_user_idx").on(t.userId),
    index("reward_bonuses_account_idx").on(t.accountId),
  ],
);

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  transactions: many(transactions),
  categories: many(categories),
  payees: many(payees),
  rewardRedemptions: many(rewardRedemptions),
  rewardBonuses: many(rewardBonuses),
}));

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
  transactions: many(transactions),
  rewardRedemptions: many(rewardRedemptions),
  rewardBonuses: many(rewardBonuses),
}));

export const rewardBonusesRelations = relations(rewardBonuses, ({ one }) => ({
  user: one(users, { fields: [rewardBonuses.userId], references: [users.id] }),
  account: one(accounts, {
    fields: [rewardBonuses.accountId],
    references: [accounts.id],
  }),
}));

export const rewardRedemptionsRelations = relations(rewardRedemptions, ({ one }) => ({
  user: one(users, { fields: [rewardRedemptions.userId], references: [users.id] }),
  account: one(accounts, {
    fields: [rewardRedemptions.accountId],
    references: [accounts.id],
  }),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, { fields: [transactions.userId], references: [users.id] }),
  account: one(accounts, {
    fields: [transactions.accountId],
    references: [accounts.id],
  }),
  toAccount: one(accounts, {
    fields: [transactions.toAccountId],
    references: [accounts.id],
  }),
  category: one(categories, {
    fields: [transactions.categoryId],
    references: [categories.id],
  }),
  payee: one(payees, { fields: [transactions.payeeId], references: [payees.id] }),
}));

export type User = typeof users.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type Payee = typeof payees.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type RewardRedemption = typeof rewardRedemptions.$inferSelect;
export type NewRewardRedemption = typeof rewardRedemptions.$inferInsert;
