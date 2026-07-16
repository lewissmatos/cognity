import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db/index.ts";
import { expenseCategoryEnum, expenses } from "@/db/schema/expenses.ts";

export type GetExpensesInput = {
  query?: {
    category?: (typeof expenseCategoryEnum)["enumValues"][number];
    amount?: number;
    merchant?: string;
    description?: string;
    startDate?: Date;
    endDate?: Date;
  };
  size: number;
};

export class ExpenseService {
  async createExpense(data: {
    amount: string;
    currency?: string;
    merchant?: string;
    category?: (typeof expenseCategoryEnum)["enumValues"][number];
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

  async getExpenses(params: GetExpensesInput) {
    const filters = params.query;
    const size = params.size ?? 100;
    return db.query.expenses.findMany({
      limit: size,
      where: (expenses, { and, eq, gte, lte }) =>
        and(
          filters?.category
            ? eq(expenses.category as any, filters.category)
            : undefined,

          filters?.amount
            ? eq(expenses.amount as any, filters.amount)
            : undefined,

          filters?.merchant
            ? eq(expenses.merchant, filters.merchant)
            : undefined,

          filters?.description
            ? eq(expenses.description, filters.description)
            : undefined,

          filters?.startDate
            ? gte(expenses.expenseDate, filters.startDate)
            : undefined,

          filters?.endDate
            ? lte(expenses.expenseDate, filters.endDate)
            : undefined,
        ),
      orderBy: (expenses, { desc }) => [desc(expenses.expenseDate)],
    });
  }
}

export const expenseService = new ExpenseService();
