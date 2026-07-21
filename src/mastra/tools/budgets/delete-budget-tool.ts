import { budgetService } from "@/services/budgets/budgets.service";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { budgetSchema } from "./create-budget-tool";
import { modifyBudgetSchema } from "./update-budget-tool";

export const deleteBudgetTool = createTool({
  id: "delete-budget-tool",

  description: `
Deletes a spending budget for one expense category.

Use this whenever the user wants to:

- delete a budget
- remove a monthly budget
`,

  inputSchema: z.object({
    searchCriteria: modifyBudgetSchema.required(),
    updateData: budgetSchema.partial().required(),
  }),
  outputSchema: z.object({
    isSuccessful: z.boolean(),

    message: z.string().optional(),

    data: budgetSchema
      .extend({
        id: z.string(),
        isActive: z.boolean(),
        createdAt: z.coerce.date(),
        updatedAt: z.coerce.date(),
      })
      .optional(),
  }),

  execute: async ({ searchCriteria }, context) => {
    const userId = context?.agent?.resourceId;
    process.stdout.write(
      `${new Date().toISOString()} - Update budget initiated with input: ${JSON.stringify(searchCriteria)}\n`,
    );

    try {
      if (!userId) {
        return {
          isSuccessful: false,
          message: "User ID not found in context.",
          data: undefined,
        };
      }

      const foundBudget = await budgetService.getBudgetByMainInput({
        userId,
        category: searchCriteria.category,
        period: searchCriteria.period,
      });

      if (!foundBudget) {
        return {
          isSuccessful: false,
          message: "No budget found matching the provided criteria.",
          data: undefined,
        };
      }

      const budget = await budgetService.deleteBudget(foundBudget.id);

      return {
        isSuccessful: true,

        data: {
          ...budget,
          limitAmount: parseFloat(budget.limitAmount),
        },
      };
    } catch (error) {
      console.error("❌ Update budget failed:", error);

      return {
        isSuccessful: false,
        message: "Failed to update budget.",
        data: undefined,
      };
    }
  },
});
