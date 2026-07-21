import {
  pgTable,
  uuid,
  decimal,
  text,
  timestamp,
  pgEnum,
  varchar,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const expenseCategoryEnum = pgEnum("expense_category", [
  "food",
  "transport",
  "shopping",
  "entertainment",
  "health",
  "education",
  "bills",
  "travel",
  "subscriptions",
  "other",
]);

export const expenses = pgTable("expenses", {
  id: uuid("id").defaultRandom().primaryKey(),

  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),

  originalAmount: decimal("original_amount", {
    precision: 10,
    scale: 2,
  }).notNull(),

  originalCurrency: varchar("original_currency", {
    length: 3,
  })
    .notNull()
    .default("DOP"),

  amount: decimal("amount", {
    precision: 10,
    scale: 2,
  }).notNull(),

  currency: varchar("currency", {
    length: 3,
  })
    .notNull()
    .default("DOP"),

  exchangeRate: decimal("exchange_rate", {
    precision: 12,
    scale: 6,
  }),

  exchangeDate: timestamp("exchange_date"),

  merchant: text("merchant"),

  category: expenseCategoryEnum("category").notNull(),

  description: text("description"),

  expenseDate: timestamp("expense_date").defaultNow().notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),

  updatedAt: timestamp("updated_at"),
});
