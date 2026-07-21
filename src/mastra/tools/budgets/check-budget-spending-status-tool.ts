import { budgetPeriodEnum } from "@/db/schema/budget";
import { expenseCategoryEnum } from "@/db/schema/expenses";
import { budgetService } from "@/services/budgets/budgets.service";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const searchBudgetSchema = z.object({
  category: z
    .enum(expenseCategoryEnum.enumValues)
    .optional()
    .describe("The category of the budget to identify it."),

  period: z
    .enum(budgetPeriodEnum.enumValues)
    .optional()
    .describe("The period of the budget to identify it."),

  startDate: z.coerce
    .date()
    .optional()
    .describe("The start date of the budget to identify it."),

  limitAmount: z
    .number()
    .optional()
    .describe("The limit amount of the budget to identify it."),
});

export const checkBudgetSpendingStatusTool = createTool({
  id: "check-budget-spending-status-tool",

  description: `
Retrieves the status of a specific budget for the current user.

Use this whenever the user wants to:

- check their budget status
- view how much of their budget has been spent
- see the remaining amount in their budget
- analyze their spending against a budget
`,

  inputSchema: z.object({
    searchCriteria: searchBudgetSchema
      .pick({
        category: true,
        period: true,
      })
      .required()
      .describe(
        "The criteria to filter budgets. If omitted, all budgets will be retrieved.",
      ),
  }),

  outputSchema: z.object({
    isSuccessful: z.boolean(),

    message: z.string().optional(),

    data: z
      .object({
        category: z.enum(expenseCategoryEnum.enumValues),
        period: z.enum(budgetPeriodEnum.enumValues),
        limitAmount: z.number(),
        totalExpenses: z.number(),
        remainingAmount: z.number(),
        usedPercentage: z.number(),
      })
      .optional(),
  }),

  execute: async (input, context) => {
    const userId = context?.agent?.resourceId;

    process.stdout.write(
      `${new Date().toISOString()} - Create budget initiated with input: ${JSON.stringify(input)}\n`,
    );

    try {
      if (!userId) {
        return {
          isSuccessful: false,
          message: "User ID is required to create a budget.",
          data: undefined,
        };
      }

      const budget = await budgetService.getBudgetStatus({
        userId,
        query: {
          ...input.searchCriteria,
        },
      });

      if (!budget) {
        return {
          isSuccessful: false,
          message: "No budget found matching the provided criteria.",
          data: undefined,
        };
      }

      return {
        isSuccessful: true,
        data: budget,
      };
    } catch (error) {
      console.error("❌ Create budget failed:", error);

      return {
        isSuccessful: false,
        message: "Failed to create budget.",
        data: undefined,
      };
    }
  },
});
