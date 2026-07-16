import { expenseCategoryEnum } from "@/db/schema/expenses.ts";
import { expenseService } from "@/services/expenses/expense.service.ts";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { expenseSchema } from "./create-expense-tool";

const getExpensesSchema = z.object({
  query: z
    .object({
      description: z
        .string()
        .optional()
        .describe("Filter expenses by description."),

      amount: z.number().optional().describe("Filter expenses by amount."),

      category: z
        .enum(expenseCategoryEnum.enumValues)
        .optional()
        .describe("Filter expenses by category."),

      merchant: z
        .string()
        .optional()
        .describe("Filter expenses by merchant name."),

      startDate: z.coerce
        .date()
        .optional()
        .describe("Only return expenses after this date."),

      endDate: z.coerce
        .date()
        .optional()
        .describe("Only return expenses before this date."),
    })
    .optional()
    .describe(
      "Optional filters to narrow down the expenses. If not provided, all expenses will be returned.",
    ),
  size: z
    .number()
    .optional()
    .default(100)
    .describe(
      "The maximum number of expenses to return. Defaults to 100 if not specified.",
    ),
});

export const getExpensesTool = createTool({
  id: "get-expenses-tool",
  description: `A tool to retrieve expense records from the database. Use this when the user wants to view, search, or analyze their expenses.
    You can filter expenses by category, merchant, and date range. The output will indicate whether the retrieval was successful and provide the list of expenses if successful.
    Use this tool whenever the user asks to view, list, search, filter, summarize, or analyze existing expenses.
    The output will include the amount, currency, merchant, category, description, expense date, and creation timestamp for each expense record.
    The input parameters are optional, and if not provided, the tool will return all expenses.
    `,
  inputSchema: getExpensesSchema,
  outputSchema: z.object({
    isSuccessful: z.boolean(),
    data: z.array(
      expenseSchema.extend({
        createdAt: z.coerce
          .date()
          .describe("The timestamp when the expense record was created."),
        id: z.guid().describe("The unique identifier of the expense record."),
      }),
    ),
  }),

  execute: async ({ query, size }) => {
    process.stdout.write(
      `${new Date().toISOString()} - Get expenses initiated with input: ${JSON.stringify({ query, size })}\n`,
    );

    try {
      const expenses = await expenseService.getExpenses({
        query: {
          category: query?.category,
          merchant: query?.merchant,
          startDate: query?.startDate,
          endDate: query?.endDate,
          amount: query?.amount,
          description: query?.description,
        },
        size: size || 100,
      });

      return {
        isSuccessful: true,
        data: expenses.map((expense) => ({
          ...expense,
          amount: Number(expense.amount),
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
