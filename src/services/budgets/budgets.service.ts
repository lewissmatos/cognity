import { db } from "@/db";
import { budgets } from "@/db/schema/budget";
import { eq, ilike } from "drizzle-orm";

export type CreateBudgetInput = typeof budgets.$inferInsert;

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

  async updateBudget(data: CreateBudgetInput) {
    const newBudget = await db
      .update(budgets)
      .set({ ...data, updatedAt: new Date() })
      .returning();
    return newBudget[0];
  }

  async inactivateBudget(budgetId: string) {
    const updatedBudget = await db
      .update(budgets)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(budgets.id, budgetId))
      .returning();

    return updatedBudget[0];
  }

  async activateBudget(budgetId: string) {
    const updatedBudget = await db
      .update(budgets)
      .set({ isActive: true, updatedAt: new Date() })
      .where(eq(budgets.id, budgetId))
      .returning();

    return updatedBudget[0];
  }

  async getBudgetByMainInput(
    filters: Pick<CreateBudgetInput, "userId" | "category" | "period">,
  ) {
    const budget = await db.query.budgets.findFirst({
      where: (budgets, { and, eq }) =>
        and(
          eq(budgets.userId, filters.userId),
          ilike(budgets.category, `%${filters.category}%`),
          ilike(budgets.period, `%${filters.period}%`),
        ),
    });

    return budget;
  }

  async getActiveBudgetsByUserId(userId: string) {
    const activeBudgets = await db.query.budgets.findMany({
      where: (budgets, { and, eq }) =>
        and(eq(budgets.userId, userId), eq(budgets.isActive, true)),
    });

    return activeBudgets;
  }
}

export const budgetService = new BudgetService();
