import { expenseService } from "@/services/expenses/expense.service.ts";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { mutateExpenseSchema } from "./update-expense-tool";
import { searchExpenseSchema } from "./get-expenses-tool";

export const deleteExpenseTool = createTool({
  id: "delete-expense-tool",

  description: `
Deletes an existing expense record for the current user.

Use this whenever the user wants to:
- delete an expense
- remove an expense
- erase an expense
- discard an expense
`,
  inputSchema: z.object({
    searchCriteria: searchExpenseSchema
      .refine(
        (criteria) =>
          Object.values(criteria).some((value) => value !== undefined),
        {
          message:
            "At least one search criteria must be provided to identify the expense.",
        },
      )
      .describe(
        "Criteria to identify the expense to update. At least one field must be provided. They work as AND conditions to find the expense.",
      ),
  }),
  outputSchema: z.object({
    isSuccessful: z.boolean(),
    message: z.string().optional(),
    data: mutateExpenseSchema
      .extend({
        id: z.string(),

        amount: z
          .number()
          .describe("Converted amount in the base currency (DOP)."),

        currency: z.string().describe("Base currency. Usually DOP."),

        createdAt: z.coerce.date(),
      })
      .optional(),
  }),

  execute: async (input, context) => {
    const userId = context?.agent?.resourceId;

    process.stdout.write(
      `${new Date().toISOString()} - Delete expense initiated with input: ${JSON.stringify(input)}\n`,
    );

    try {
      if (!userId) {
        return {
          isSuccessful: false,
          message: "User ID is required to delete an expense.",
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

      if (!expense) {
        return {
          isSuccessful: false,
          message: "Expense not found or does not belong to the user.",
        };
      }

      const deletedExpense = await expenseService.deleteExpense(expense.id);

      process.stdout.write(
        `✅ Expense deleted successfully: ${JSON.stringify(deletedExpense)}\n`,
      );

      return {
        isSuccessful: true,
        data: {
          id: deletedExpense.id,

          originalAmount: Number(deletedExpense.originalAmount),
          originalCurrency: deletedExpense.originalCurrency ?? undefined,

          amount: Number(deletedExpense.amount),
          currency: deletedExpense.currency,

          merchant: deletedExpense.merchant ?? undefined,

          category: deletedExpense.category ?? undefined,

          description: deletedExpense.description ?? undefined,

          expenseDate: deletedExpense.expenseDate,

          createdAt: deletedExpense.createdAt,
        },
      };
    } catch (error) {
      console.error("❌ Delete expense failed:", error);

      return {
        isSuccessful: false,
        message: "Unable to delete expense.",
      };
    }
  },
});
