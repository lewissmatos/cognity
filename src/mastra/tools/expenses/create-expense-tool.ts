import { expenseCategoryEnum } from "@/db/schema/expenses.ts";
import { expenseService } from "@/services/expenses/expense.service.ts";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
export const expenseSchema = z.object({
  originalAmount: z
    .number()
    .positive()
    .describe(
      "The original amount spent by the user. Always use the exact amount provided by the user.",
    ),

  originalCurrency: z
    .string()
    .default("DOP")
    .describe(
      "The original currency of the expense. Use the currency provided by the user (for example USD, EUR, DOP). If not specified, assume DOP.",
    ),

  merchant: z
    .string()
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
});

export const createExpenseTool = createTool({
  id: "create-expense-tool",
  description: `
Creates a new expense record for the current user.

Rules:
- Always preserve the original amount and currency provided by the user.
- Do not manually convert currencies.
- Currency conversion is handled automatically by the expense service.
- If the user does not specify a currency, assume DOP.
- Never create expenses without using this tool.
`,
  inputSchema: expenseSchema,
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
      `${new Date().toISOString()} - Create expense initiated with input: ${JSON.stringify(input)}\n`,
    );

    try {
      if (!userId) {
        return {
          isSuccessful: false,
          message: "User ID is required to create an expense.",
          data: undefined,
        };
      }

      const expense = await expenseService.createExpense({
        userId: userId,
        originalAmount: input.originalAmount.toString(),
        originalCurrency: input.originalCurrency,
        merchant: input.merchant,
        category: input.category,
        description: input.description,
        expenseDate: input.expenseDate
          ? new Date(input.expenseDate)
          : undefined,
      });

      process.stdout.write(
        `✅ Expense created successfully: ${JSON.stringify(expense)}\n`,
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
      console.error("❌ Create expense failed:", error);

      return {
        isSuccessful: false,
        data: undefined,
      };
    }
  },
});
