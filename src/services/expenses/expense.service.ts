import { db } from '@/db/index.ts';
import { expenseCategoryEnum, expenses } from "@/db/schema/expenses.ts";

export class ExpenseService {
  async createExpense(data: {
    amount: string;
    currency?: string;
    merchant?: string;
    category?: 
      typeof expenseCategoryEnum["enumValues"][number];
    description?: string;
    expenseDate?: Date;
  }) {
    const [expense] = await db
      .insert(expenses)
      .values({
        amount: data.amount,
        currency: data.currency ?? "DOP",
        merchant: data.merchant,
        category: data.category,
        description: data.description,
        expenseDate: data.expenseDate,
      })
      .returning();

    return expense;
  }

  async getExpenses() {
    return db.select().from(expenses);
  }
}

export const expenseService = new ExpenseService();