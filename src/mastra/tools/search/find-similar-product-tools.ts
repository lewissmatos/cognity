import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { expenseSchema } from "../expenses/create-expense-tool";
import { expenseService } from "@/services/expenses/expense.service";
import { searchExpenseSchema } from "../expenses/get-expenses-tool";
import { TavilySearchResponse, tavilySearchTool } from "./tavily-search-tool";

export const findSimilarProductsTool = createTool({
  id: "find-similar-products-tool",
  description: `
Finds similar products online based on one of the user's expenses.

Use this when the user wants:
- alternatives to something they bought
- similar products
- cheaper options
- recommendations based on an expense

The tool retrieves the expense information first and then searches the web.
`,
  inputSchema: z.object({
    expenseCriteria: searchExpenseSchema
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

    expense: expenseSchema.optional(),

    products: z.array(
      z.object({
        title: z
          .string()
          .nullable()
          .describe("The title or name of the similar product."),
        url: z.string(),
        content: z
          .string()
          .optional()
          .describe("The content or description of the similar product."),
        publishedAt: z
          .string()
          .optional()
          .describe("The publication date of the similar product."),
      }),
    ),
  }),

  execute: async (input, context) => {
    const userId = context?.agent?.resourceId;

    const { expenseCriteria } = input;
    if (!userId) {
      return {
        isSuccessful: false,
        message: "User ID is required to find similar products.",
        expense: undefined,
        products: [],
      };
    }
    const expense = await expenseService.getExpense({
      userId,
      query: {
        ...expenseCriteria,
        amount: expenseCriteria.amount?.toString(),
        originalAmount: expenseCriteria.originalAmount?.toString(),
      },
    });

    if (!expense) {
      return {
        isSuccessful: false,
        message: "Expense not found.",
        expense: undefined,
        products: [],
      };
    }

    const query = `
      Similar products to:
      ${expense.description}
      ${expense.merchant || ""}
      category:${expense.category}
    `;

    const searchResponse = await tavilySearchTool?.execute?.(
      {
        query,
        options: {
          maxResults: 5,
          topic: "general",
        },
      },
      context,
    );


    if (!searchResponse) {
      return {
        isSuccessful: false,
        message: "Failed to retrieve similar products.",
        expense: {
          ...expense,
          originalAmount: Number(expense.originalAmount),
          amount: Number(expense.amount),
          merchant: expense.merchant ?? undefined,
          category: expense.category ?? undefined,
          description: expense.description ?? undefined,
        },
        products: [],
      };
    }

    const products = (searchResponse as TavilySearchResponse).results ?? [];
    return {
      isSuccessful: true,
      expense: {
        ...expense,
        originalAmount: Number(expense.originalAmount),
        amount: Number(expense.amount),
        merchant: expense.merchant ?? undefined,
        category: expense.category ?? undefined,
        description: expense.description ?? undefined,
      },
      products: products
        .map((item) => {
          return {
            title: item.title ?? null,
            url: item.url,
            content: item.content ?? null,
          };
        })
        .filter((item) => item !== null),
    };
  },
});
