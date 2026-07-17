import { expenseService } from "@/services/expenses/expense.service.ts";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { expenseSchema } from "./create-expense-tool";
import { searchExpenseSchema } from "./update-expense-tool";

export const getSingleExpenseTool = createTool({
  id: "get-single-expense-tool",
  description: `
Retrieves a single expense record for the current user.
Rules:
- Always use the tool to retrieve an expense.
- Use the expense ID to identify which expense to retrieve.
- If the expense ID does not exist or does not belong to the user, return an error message.
`,
  inputSchema: z.object({
    searchCriteria: searchExpenseSchema,
  }),
  outputSchema: z.object({
    isSuccessful: z.boolean(),
    message: z.string().optional(),
    data: expenseSchema
      .extend({
        id: z.string(),
        convertedAmount: z
          .number()
          .describe(
            "The expense amount converted to the system base currency (DOP).",
          ),
        amount: z
          .number()
          .describe("The converted amount in the base currency (DOP)."),
        currency: z.string().describe("The base currency. Usually DOP."),

        createdAt: z.coerce.date(),
      })
      .optional(),
  }),
  execute: async (input, context) => {
    const userId = context?.agent?.resourceId;

    process.stdout.write(
      `${new Date().toISOString()} - Get single expense initiated with input: ${JSON.stringify(input)}\n`,
    );

    try {
      if (!userId) {
        return {
          isSuccessful: false,
          message: "User ID is required to retrieve an expense.",
          data: undefined,
        };
      }

       const expense = await expenseService.getExpense({
        userId,
        query: {
          ...input.searchCriteria,
          amount: input.searchCriteria.amount?.toString(),
          originalAmount: input.searchCriteria.originalAmount?.toString(),
        },
      });

      if (!expense || expense.userId !== userId) {
        return {
          isSuccessful: false,
          message: "Expense not found or does not belong to the user.",
          data: undefined,
        };
      }

      process.stdout.write(
        `✅ Expense retrieved successfully: ${JSON.stringify(expense)}\n`,
      );

      return {
        isSuccessful: true,
        data: {
          originalAmount: parseFloat(expense.originalAmount),
          originalCurrency: expense.originalCurrency ?? undefined,
          merchant: expense.merchant ?? undefined,
          category: expense.category ?? undefined,
          description: expense.description ?? undefined,
          expenseDate: expense.expenseDate,
          id: expense.id,
          convertedAmount: parseFloat(expense.amount),
          currency: expense.currency,
          createdAt: expense.createdAt,
          amount: parseFloat(expense.amount),
        },
      };
    } catch (error) {
      console.error("❌ Get single expense failed:", error);

      return {
        isSuccessful: false,
        data: undefined,
      };
    }
  },
});
