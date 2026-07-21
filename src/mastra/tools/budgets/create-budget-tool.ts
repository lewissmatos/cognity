import { budgetPeriodEnum } from "@/db/schema/budget";
import { expenseCategoryEnum } from "@/db/schema/expenses";
import { budgetService } from "@/services/budgets/budgets.service";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const budgetSchema = z.object({
  category: z
    .enum(expenseCategoryEnum.enumValues)
    .default("OTHER")
    .describe(
      "The category of the budget. Must be one of the predefined expense categories.",
    ),

  limitAmount: z
    .number()
    .positive()
    .describe(
      "Maximum amount the user wants to spend during the selected period.",
    ),

  currency: z
    .string()
    .default("DOP")
    .describe("The budget currency. If omitted, assume DOP."),

  period: z
    .enum(budgetPeriodEnum.enumValues)
    .default("MONTHLY")
    .describe("How often the budget resets."),

  startDate: z.coerce
    .date()
    .optional()
    .describe("The date the budget starts. Defaults to today if omitted."),
});

export const createBudgetTool = createTool({
  id: "create-budget-tool",

  description: `
Creates a spending budget for one expense category.

Use this whenever the user wants to:

- create a budget
- set a monthly budget
- limit spending
- establish a spending limit

`,

  inputSchema: budgetSchema,

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

      const budget = await budgetService.createBudget({
        userId,
        ...input,
        limitAmount: input.limitAmount.toString(),
        startDate: input.startDate ?? new Date(),
      });

      return {
        isSuccessful: true,

        data: {
          ...budget,
          limitAmount: parseFloat(budget.limitAmount),
        },
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
