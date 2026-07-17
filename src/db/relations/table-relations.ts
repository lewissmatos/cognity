import { relations } from "drizzle-orm";
import { users } from "../schema/users";
import { expenses } from "../schema/expenses";

export const usersRelations = relations(users, ({ many }) => ({
  expenses: many(expenses),
}));

export const expensesRelations = relations(expenses, ({ one }) => ({
  user: one(users, {
    fields: [expenses.userId],
    references: [users.id],
  }),
}));