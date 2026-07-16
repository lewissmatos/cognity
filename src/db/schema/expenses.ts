import {
  pgTable,
  uuid,
  decimal,
  text,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";

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

  amount: decimal("amount", {
    precision: 10,
    scale: 2,
  }).notNull(),

  currency: text("currency").notNull().default("DOP"),

  merchant: text("merchant"),

  category: expenseCategoryEnum("category"),

  description: text("description"),

  expenseDate: timestamp("expense_date").defaultNow().notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});
