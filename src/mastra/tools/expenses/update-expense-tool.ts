import { expenseService } from "@/services/expenses/expense.service.ts";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { expenseSchema } from "./create-expense-tool";
import { expenseCategoryEnum } from "@/db/schema/expenses";
import { searchExpenseSchema } from "./get-expenses-tool";

export const mutateExpenseSchema = z
  .object({
    originalAmount: z
      .number()
      .positive()
      .optional()
      .describe(
        "The original amount spent by the user. Always use the exact amount provided by the user.",
      ),

    originalCurrency: z
      .string()
      .default("DOP")
      .optional()
      .describe(
        "The original currency of the expense. Use the currency provided by the user (for example USD, EUR, DOP). If not specified, assume DOP.",
      ),

    merchant: z
      .string()
      .optional()
      .optional()
      .describe("The merchant or place where the expense happened."),

    category: z
      .enum(expenseCategoryEnum.enumValues)
      .optional()
      .describe("The category of the expense."),

    description: z
      .string()
      .optional()
      .describe("Additional details about the expense."),

    expenseDate: z.coerce
      .date()
      .optional()
      .describe(
        "The date when the expense happened. If not provided, use today's date.",
      ),
  })
  .refine(
    (criteria) => Object.values(criteria).some((value) => value !== undefined),
    {
      message: "At least one field must be provided to update the expense.",
    },
  )
  .describe("The new data to update the expense with.");

export const updateExpenseTool = createTool({
  id: "update-expense-tool",
  description: `
Updates an existing expense record for the current user.
Rules:
- Preserve the existing original amount and original currency unless the user explicitly requests changing them.
- Never overwrite originalAmount or originalCurrency accidentally when updating unrelated fields.
- Do not manually convert currencies.
- Currency conversion is handled automatically by the expense service.
- If the user does not specify a currency, assume DOP.
- Never update expenses without using this tool.
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
    updateData: mutateExpenseSchema,
  }),
  outputSchema: z.object({
    isSuccessful: z.boolean(),
    message: z.string().optional(),
    data: expenseSchema
      .extend({
        id: z.string(),

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
      `${new Date().toISOString()} - Update expense initiated with input: ${JSON.stringify(input)}\n`,
    );

    try {
      if (!userId) {
        return {
          isSuccessful: false,
          message: "User ID is required to update an expense.",
          data: undefined,
        };
      }

      const foundExpense = await expenseService.getExpense({
        userId,
        query: {
          ...input.searchCriteria,
          amount: input.searchCriteria.amount?.toString(),
          originalAmount: input.searchCriteria.originalAmount?.toString(),
        },
      });

      process.stdout.write(
        `${new Date().toISOString()} - Found expense: ${JSON.stringify(foundExpense)}\n`,
      );

      if (!foundExpense) {
        return {
          isSuccessful: false,
          message: "Expense not found or does not belong to the user.",
          data: undefined,
        };
      }
      const expense = await expenseService.updateExpense(foundExpense.id, {
        ...input.updateData,
        originalAmount: input.updateData.originalAmount?.toString(),
      });

      process.stdout.write(
        `✅ Expense updated successfully: ${JSON.stringify(expense)}\n`,
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
          currency: expense.currency,
          createdAt: expense.createdAt,
          amount: parseFloat(expense.amount),
        },
      };
    } catch (error) {
      console.error("❌ Update expense failed:", error);

      return {
        isSuccessful: false,
        data: undefined,
      };
    }
  },
});
