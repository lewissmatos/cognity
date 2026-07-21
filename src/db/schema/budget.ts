import {
  boolean,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { expenseCategoryEnum } from "./expenses";
import { users } from "./users";

export const budgetPeriodEnum = pgEnum("budget_period", [
  "WEEKLY",
  "MONTHLY",
  "YEARLY",
]);

export const budgets = pgTable("budgets", {
  id: uuid("id").primaryKey().defaultRandom(),

  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),

  category: expenseCategoryEnum("category").notNull(),

  limitAmount: numeric("limit_amount", {
    precision: 12,
    scale: 2,
  }).notNull(),

  currency: varchar("currency", {
    length: 3,
  })
    .notNull()
    .default("DOP"),

  period: budgetPeriodEnum("period").notNull(),

  startDate: timestamp("start_date").notNull(),

  endDate: timestamp("end_date"),

  isActive: boolean("is_active").notNull().default(true),

  createdAt: timestamp("created_at").defaultNow().notNull(),

  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});
