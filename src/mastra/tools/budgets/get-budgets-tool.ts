import { budgetPeriodEnum } from "@/db/schema/budget";
import { expenseCategoryEnum } from "@/db/schema/expenses";
import { budgetService } from "@/services/budgets/budgets.service";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { budgetSchema } from "./create-budget-tool";

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

export const getBudgetsTool = createTool({
  id: "get-budgets-tool",

  description: `
Retrieves a list of budgets for the current user.

Use this whenever the user wants to:

- view their budgets
- see their spending limits
- check their budget status
`,

  inputSchema: z.object({
    searchCriteria: searchBudgetSchema
      .optional()
      .describe(
        "The criteria to filter budgets. If omitted, all budgets will be retrieved.",
      ),

    size: z
      .number()
      .int()
      .positive()
      .default(10)
      .describe("The maximum number of budgets to retrieve."),
  }),

  outputSchema: z.object({
    isSuccessful: z.boolean(),

    message: z.string().optional(),

    data: z.array(
      budgetSchema
        .extend({
          id: z.string(),
          isActive: z.boolean(),
          createdAt: z.coerce.date(),
          updatedAt: z.coerce.date(),
        })
        .optional(),
    ),
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
          data: [],
        };
      }

      const budgets = await budgetService.getActiveBudgetsByUserId({
        userId,
        query: {
          ...input.searchCriteria,
          limitAmount: input.searchCriteria?.limitAmount?.toString(),
        },
        size: input.size,
      });

      return {
        isSuccessful: true,

        data:
          budgets.map((budget) => ({
            ...budget,
            limitAmount: parseFloat(budget.limitAmount),
          })) || [],
      };
    } catch (error) {
      console.error("❌ Create budget failed:", error);

      return {
        isSuccessful: false,
        message: "Failed to create budget.",
        data: [],
      };
    }
  },
});
