import { db } from "@/db";
import { budgets } from "@/db/schema/budget";
import { eq, ilike } from "drizzle-orm";
import { expenseService } from "../expenses/expense.service";

export type GetBudgetsInput = {
  userId: string;
  query?: Partial<typeof budgets.$inferSelect> & {};
  size: number;
};

export type CreateBudgetInput = Omit<
  typeof budgets.$inferInsert,
  "id" | "createdAt" | "updatedAt" | "isActive"
>;
export class BudgetService {
  async createBudget(data: CreateBudgetInput) {
    const existingBudget = await this.getBudgetByMainInput({
      userId: data.userId,
      category: data.category,
      period: data.period,
    });

    if (existingBudget) {
      throw new Error(
        "A budget with the same user ID, category, and period already exists.",
      );
    }

    const newBudget = await db.insert(budgets).values(data).returning();
    return newBudget[0];
  }

  async updateBudget(
    data: Partial<Omit<CreateBudgetInput, "userId">> & { id: string },
  ) {
    const newBudget = await db
      .update(budgets)
      .set({ ...data })
      .where(eq(budgets.id, data.id!))
      .returning();
    return newBudget[0];
  }

  async deleteBudget(budgetId: string) {
    const updatedBudget = await db
      .update(budgets)
      .set({ isActive: false })
      .where(eq(budgets.id, budgetId))
      .returning();

    return updatedBudget[0];
  }

  async getBudgetByMainInput(
    filters: Required<
      Pick<CreateBudgetInput, "userId" | "category" | "period">
    >,
  ) {
    try {
      const budget = await db.query.budgets.findFirst({
        where: (budgets, { and, eq }) =>
          and(
            eq(budgets.userId, filters.userId),
            eq(budgets.category, filters.category),
            eq(budgets.period, filters.period),
          ),
      });

      return budget;
    } catch (error) {
      console.error("❌ Get budget by main input failed:", error);
      throw new Error("Failed to get budget by main input.");
    }
  }

  async getActiveBudgetsByUserId(params: GetBudgetsInput) {
    const { userId, query } = params;
    const activeBudgets = await db.query.budgets.findMany({
      where: (budgets, { and, eq }) =>
        and(
          eq(budgets.userId, userId),
          eq(budgets.isActive, true),
          query
            ? and(
                ...Object.entries(query)
                  .filter(([_, value]) => !!value)
                  .map(([key, value]) =>
                    eq(
                      budgets[key as any as keyof typeof budgets] as any,
                      value,
                    ),
                  ),
              )
            : undefined,
        ),
    });

    return activeBudgets;
  }

  async getBudgetStatus(params: {
    userId: string;
    query: Pick<CreateBudgetInput, "category" | "period">;
  }) {
    try {
      const { userId, query } = params;
      const budget = await this.getBudgetByMainInput({
        userId,
        category: query?.category as any,
        period: query?.period as any,
      });

      if (!budget) {
        return null;
      }

      const { startDate, endDate } = getRanges(budget.period);

      const expenses = await expenseService.getExpenses({
        userId,
        query: {
          category: budget?.category,
          startDate,
          endDate,
        },
        size: 10000,
      });

      return {
        category: budget.category,
        period: budget.period,
        limitAmount: parseFloat(budget.limitAmount),
        totalExpenses: expenses.reduce(
          (sum, expense) => sum + Number.parseFloat(expense.amount.toString()),
          0,
        ),
        remainingAmount:
          parseFloat(budget.limitAmount) -
          expenses.reduce(
            (sum, expense) =>
              sum + Number.parseFloat(expense.amount.toString()),
            0,
          ),
        usedPercentage:
          (expenses.reduce(
            (sum, expense) =>
              sum + Number.parseFloat(expense.amount.toString()),
            0,
          ) /
            parseFloat(budget.limitAmount)) *
          100,
      };
    } catch (error) {
      console.error("❌ Get budget status failed:", error);
      throw new Error("Failed to get budget status.");
    }
  }
}

const getRanges = (period: (typeof budgets.$inferSelect)["period"]) => {
  const today = new Date();
  let startDate: Date;
  let endDate: Date;

  switch (period) {
    case "WEEKLY":
      startDate = new Date(today);
      startDate.setDate(today.getDate() - today.getDay());
      startDate.setHours(0, 0, 0, 0);

      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);
      break;

    case "MONTHLY":
      startDate = new Date(today.getFullYear(), today.getMonth(), 1);
      startDate.setHours(0, 0, 0, 0);

      endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      endDate.setHours(23, 59, 59, 999);
      break;

    case "YEARLY":
      startDate = new Date(today.getFullYear(), 0, 1);
      startDate.setHours(0, 0, 0, 0);

      endDate = new Date(today.getFullYear(), 11, 31);
      endDate.setHours(23, 59, 59, 999);
      break;

    default:
       startDate = new Date(today.getFullYear(), today.getMonth(), 1);
      startDate.setHours(0, 0, 0, 0);

      endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      endDate.setHours(23, 59, 59, 999);
  }
  return { startDate, endDate };
};

export const budgetService = new BudgetService();
