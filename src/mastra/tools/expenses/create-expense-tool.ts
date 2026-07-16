import { expenseCategoryEnum } from "@/db/schema/expenses.ts";
import { expenseService } from "@/services/expenses/expense.service.ts";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const expenseSchema = z.object({
  amount: z
    .number()
    .positive()
    .describe("The amount of the expense. Must be a positive number."),
  currency: z
    .string()
    .optional()
    .default("DOP")
    .describe(
      "The currency of the expense. If not provided, use 'DOP' (Dominican Peso) as the default currency.",
    ),
  merchant: z
    .string()
    .optional()
    .describe("The name of the merchant or vendor where the expense occurred."),
  category: z
    .enum(expenseCategoryEnum.enumValues)
    .optional()
    .describe(
      "The category of the expense. Must be one of the predefined categories.",
    ),
  description: z
    .string()
    .optional()
    .describe("A brief description of the expense."),
  expenseDate: z.coerce
    .date()
    .optional()
    .describe(
      "The date when the expense occurred in ISO format (YYYY-MM-DD). If not provided, use the current date.",
    ),
});

export const createExpenseTool = createTool({
  id: "create-expense-tool",
  description:
    "A tool to create an expense record in the database. Keep the amount positive, and if the currency is not provided, default to 'DOP'. The output will indicate whether the expense was successfully created and provide the created expense record if successful.",
  inputSchema: expenseSchema,
  outputSchema: z.object({
    isSuccessful: z
      .boolean()
      .describe("Indicates whether the expense was successfully created."),
    data: expenseSchema
      .extend({
        createdAt: z.coerce
          .date()
          .describe("The timestamp when the expense record was created."),
      })
      .optional()
      .describe("The created expense record, if the operation was successful."),
  }),
  execute: async (input) => {
    process.stdout.write(
      `${new Date().toISOString()} - Create expense initiated with input: ${JSON.stringify(input)}\n`,
    );
    try {
      const expense = await expenseService.createExpense({
        amount: input.amount.toString(),
        currency: input.currency,
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
      const { id, ...rest } = expense;
      return {
        isSuccessful: true,
        data: {
          ...rest,
          amount: parseFloat(expense.amount),
          merchant: expense.merchant ?? undefined,
          category: expense.category ?? undefined,
          description: expense.description ?? undefined,
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
