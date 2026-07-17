import { db } from "@/db/index.ts";
import { expenseCategoryEnum, expenses } from "@/db/schema/expenses.ts";
import { currencyService } from "./exchange.service";
import { userService } from "./user.service";

export type GetExpensesInput = {
  userId: string;
  query?: {
    category?: (typeof expenseCategoryEnum)["enumValues"][number];
    amount?: number;
    merchant?: string;
    description?: string;
    startDate?: Date;
    endDate?: Date;
    originalCurrency?: string;
  };
  size: number;
};

export type CreateExpenseInput = Omit<
  typeof expenses.$inferInsert,
  | "amount"
  | "currency"
  | "exchangeRate"
  | "exchangeDate"
> 
export class ExpenseService {
  async createExpense(data: CreateExpenseInput) {
    const conversion = await currencyService.convertToBaseCurrency(
      Number(data.originalAmount),
      data.originalCurrency ?? "DOP",
    );

    const user = await userService.getUser(data.userId);
    
    if (!user) {
      throw new Error(`User with id ${data.userId} not found`);
    };
    
    const [expense] = await db
      .insert(expenses)
      .values({
        userId: user?.id,
        originalAmount: conversion.originalAmount.toString(),
        originalCurrency: conversion.originalCurrency,
        exchangeRate: conversion.exchangeRate.toString(),
        exchangeDate: conversion.exchangeDate,
        amount: conversion.convertedAmount.toString(),
        currency: conversion.convertedCurrency,

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
    const userId = params.userId;
    const size = params.size ?? 100;
    return db.query.expenses.findMany({
      limit: size,
      where: (expenses, { and, eq, gte, lte }) =>
        and(
          eq(expenses.userId, userId),

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