import { expenseService } from "@/services/expenses/expense.service.ts";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { expenseSchema } from "./create-expense-tool";
import { expenseCategoryEnum } from "@/db/schema/expenses";

export const searchExpenseSchema = z
  .object({
    description: z
      .string()
      .optional()
      .describe("The description of the expense to identify it."),
    merchant: z
      .string()
      .optional()
      .describe("The merchant of the expense to identify it."),
    category: z
      .enum(expenseCategoryEnum.enumValues)
      .optional()
      .describe("The category of the expense to identify it."),
    amount: z
      .number()
      .optional()
      .describe("The amount of the expense to identify it."),
    currency: z
      .string()
      .optional()
      .describe("The currency of the expense to identify it."),
    expenseDate: z.coerce
      .date()
      .optional()
      .describe("The date of the expense to identify it."),
    originalAmount: z
      .number()
      .optional()
      .describe("The original amount of the expense to identify it."),
    originalCurrency: z
      .string()
      .optional()
      .describe("The original currency of the expense to identify it."),
    exchangeDate: z.coerce
      .date()
      .optional()
      .describe("The exchange date of the expense to identify it."),
  })
export const getExpensesTool = createTool({
  id: "get-expenses-tool",
  description: `A tool to retrieve expense records from the database. Use this when the user wants to view, search, or analyze their expenses.
    You can filter expenses by category, merchant, and date range. The output will indicate whether the retrieval was successful and provide the list of expenses if successful.
    Use this tool whenever the user asks to view, list, search, filter, summarize, or analyze existing expenses.
    The output will include the amount, currency, merchant, category, description, expense date, and creation timestamp for each expense record.
    The input parameters are optional, and if not provided, the tool will return all expenses.
    `,
  inputSchema: z
    .object({
      searchCriteria: searchExpenseSchema.extend({
        startDate: z.coerce
          .date()
          .optional()
          .describe(
            "The start date for filtering expenses. Only expenses on or after this date will be returned.",
          ),
        endDate: z.coerce
          .date()
          .optional()
          .describe(
            "The end date for filtering expenses. Only expenses on or before this date will be returned.",
          ),
      }).optional()
    })
    .extend({
      size: z
        .number()
        .optional()
        .describe(
          "The maximum number of expenses to retrieve. Defaults to 100.",
        ),
    }),
  outputSchema: z.object({
    isSuccessful: z.boolean(),
    message: z.string().optional(),
    data: z.array(
      expenseSchema.extend({
        createdAt: z.coerce
          .date()
          .describe("The timestamp when the expense record was created."),
        id: z.guid().describe("The unique identifier of the expense record."),
      }),
    ),
  }),

  execute: async ({ searchCriteria: query, size }, context) => {
    const userId = context?.agent?.resourceId;

    process.stdout.write(
      `${new Date().toISOString()} - Get expenses initiated with input: ${JSON.stringify({ query: query, size: 100 })}\n`,
    );

    try {
      if (!userId) {
        return {
          isSuccessful: false,
          data: [],
          message: "User ID is required to retrieve expenses.",
        };
      }
      const expenses = await expenseService.getExpenses({
        userId: userId,
        query: {
          category: query?.category,
          merchant: query?.merchant,
          startDate: query?.startDate,
          endDate: query?.endDate,
          amount: query?.amount?.toString(),
          expenseDate: query?.expenseDate,
          currency: query?.currency,
          originalAmount: query?.originalAmount?.toString(),
          originalCurrency: query?.originalCurrency,
          description: query?.description,
        },
        size: size || 100,
      });

      return {
        isSuccessful: true,
        data: expenses.map((expense) => ({
          ...expense,
          originalAmount: Number(expense.originalAmount),
          originalCurrency: expense.originalCurrency ?? undefined,
          amount: Number(expense.amount),
          currency: expense.currency ?? undefined,
          exchangeRate: Number(expense.exchangeRate ?? "1"),
          exchangeDate: expense.exchangeDate ?? undefined,
          merchant: expense.merchant ?? undefined,
          category: expense.category ?? undefined,
          description: expense.description ?? undefined,
        })),
      };
    } catch (error) {
      process.stderr.write(
        `${new Date().toISOString()} - Get expenses failed: ${error}\n`,
      );

      return {
        isSuccessful: false,
        data: [],
      };
    }
  },
});
