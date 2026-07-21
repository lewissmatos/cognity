import { db } from "@/db/index.ts";
import { expenseCategoryEnum, expenses } from "@/db/schema/expenses.ts";
import { currencyService } from "./exchange.service";
import { userService } from "../users/user.service";
import { eq, ilike } from "drizzle-orm";

export type GetExpensesInput = {
  userId: string;
  query?: Partial<typeof expenses.$inferSelect> & {
    startDate?: Date;
    endDate?: Date;
  };
  size: number;
};

export type CreateExpenseInput = Omit<
  typeof expenses.$inferInsert,
  "amount" | "currency" | "exchangeRate" | "exchangeDate"
>;
export class ExpenseService {
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
            ? eq(expenses.category, filters.category)
            : undefined,

          filters?.amount !== undefined
            ? eq(expenses.amount, filters.amount)
            : undefined,

          filters?.currency
            ? eq(expenses.currency, filters.currency)
            : undefined,

          filters?.originalAmount !== undefined
            ? eq(expenses.originalAmount, filters.originalAmount)
            : undefined,

          filters?.originalCurrency
            ? eq(expenses.originalCurrency, filters.originalCurrency)
            : undefined,

          filters?.exchangeRate
            ? eq(expenses.exchangeRate, filters.exchangeRate)
            : undefined,

          filters?.exchangeDate
            ? eq(expenses.exchangeDate, filters.exchangeDate)
            : undefined,

          filters?.merchant
            ? ilike(expenses.merchant, `%${filters.merchant}%`)
            : undefined,

          filters?.description
            ? ilike(expenses.description, `%${filters.description}%`)
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

  async getExpense(params: {
    userId: string;
    query: Partial<GetExpensesInput["query"]>;
  }) {
    const filters = params.query;
    const userId = params.userId;
    process.stdout.write(
      `Searching for expense with filters: ${JSON.stringify({
        filters,
        userId,
      })}\n`,
    );
    return db.query.expenses.findFirst({
      where: (expenses, { and, eq }) =>
        and(
          eq(expenses.userId, userId),

          filters?.description
            ? ilike(expenses.description, `%${filters.description}%`)
            : undefined,

          filters?.category
            ? eq(expenses.category, filters.category)
            : undefined,

          filters?.amount !== undefined
            ? eq(expenses.amount, filters.amount)
            : undefined,

          filters?.currency
            ? eq(expenses.currency, filters.currency)
            : undefined,

          filters?.originalAmount !== undefined
            ? eq(expenses.originalAmount, filters.originalAmount)
            : undefined,

          filters?.originalCurrency
            ? eq(expenses.originalCurrency, filters.originalCurrency)
            : undefined,

          filters?.exchangeDate
            ? eq(expenses.exchangeDate, filters.exchangeDate)
            : undefined,

          filters?.merchant
            ? ilike(expenses.merchant, `%${filters.merchant}%`)
            : undefined,
        ),
      orderBy: (expenses, { desc }) => [desc(expenses.expenseDate)],
    });
  }

  async getExpenseById(expenseId: string) {
    const expense = await db.query.expenses.findFirst({
      where: (expenses, { eq }) => eq(expenses.id, expenseId),
    });

    return expense;
  }

  async createExpense(data: CreateExpenseInput) {
   try {
     const conversion = await currencyService.convertToBaseCurrency(
      Number(data.originalAmount),
      data.originalCurrency ?? "DOP",
    );

    const user = await userService.getUser(data.userId);

    if (!user) {
      throw new Error(`User with id ${data.userId} not found`);
    }

    if (!expenseCategoryEnum.enumValues.includes(data.category)) {
      throw new Error(
        `Invalid category: ${data.category}. Must be one of: ${expenseCategoryEnum.enumValues.join(
          ", ",
        )}`,
      );
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
    } catch (error) {
      console.error("CREATE EXPENSE ERROR:", error);
      throw error;
    }
  }

  async deleteExpense(expenseId: string) {
    const deletedExpense = await db
      .delete(expenses)
      .where(eq(expenses.id, expenseId))
      .returning();
    return deletedExpense[0];
  }

  async updateExpense(
    expenseId: string,
    data: Partial<Omit<CreateExpenseInput, "userId">>,
  ) {
    let conversion = null;

    if (!!data.originalAmount || !!data.originalCurrency) {
      conversion = await currencyService.convertToBaseCurrency(
        Number(data.originalAmount ?? 0),
        data.originalCurrency ?? "DOP",
      );
    }

    const updatedExpenses = await db
      .update(expenses)
      .set({
        ...data,
        ...(!!conversion
          ? {
              originalAmount: conversion.originalAmount.toString(),
              originalCurrency: conversion.originalCurrency,
              exchangeRate: conversion.exchangeRate.toString(),
              exchangeDate: conversion.exchangeDate,
              amount: conversion.convertedAmount.toString(),
              currency: conversion.convertedCurrency,
              updatedAt: new Date(),
            }
          : {}),
      })
      .where(eq(expenses.id, expenseId))
      .returning();
    return updatedExpenses[0];
  }
}

export const expenseService = new ExpenseService();
