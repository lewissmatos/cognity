import { createTool } from "@mastra/core/tools";
import {
  agenticToolInputSchema,
  agenticToolOutputSchema,
  executeAgenticTool,
} from "../auxiliars/common";

export const expenseAgenticTool = createTool({
  id: "expense-agent-tool",

  description: `
Handles expense management and purchase-related requests.

Use this when the user wants to:

- record a new expense
- add a purchase or payment
- view expense history
- find previous expenses or purchases
- retrieve a specific expense
- update an existing expense
- delete an expense
- get product recommendations based on previous purchases

Examples:

"I spent 500 pesos on lunch"
"Add my Uber payment"
"Show my expenses this month"
"What did I buy last week?"
"Delete my last purchase"
"Find something similar to my headphones"

Do not use this for:

- creating budgets
- modifying budgets
- checking budget limits
- monitoring budget progress
- general financial analysis

This tool delegates the request to the specialized Expense Agent.
`,
  inputSchema: agenticToolInputSchema.describe(
    "The plain text user's expense-related request. User's expense message should be passed as input to this tool.",
  ),
  outputSchema: agenticToolOutputSchema,
  execute: async (input, context) => {
    return await executeAgenticTool(input, context, "expenseAgent");
  },
});
