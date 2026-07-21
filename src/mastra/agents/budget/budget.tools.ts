import { createTool } from "@mastra/core/tools";
import { agenticToolInputSchema, agenticToolOutputSchema, executeAgenticTool } from "../auxiliars/common";

export const budgetAgenticTool = createTool({
  id: "budget-agent-tool",

  description: `
Handles budget management and budget monitoring requests.

Use this when the user wants to:

- create a new budget
- view existing budgets
- update a budget
- delete a budget
- check budget spending progress
- know remaining budget amount
- know if they are over or under budget
- see how much of a budget has been used

Examples:

"Create a monthly food budget of 15000 pesos"

"Show my budgets"

"Increase my shopping budget"

"Delete my transportation budget"

"How much food budget do I have left?"

"Am I over my entertainment budget?"

"What percentage of my budget have I used?"

Do not use this for:

- recording expenses
- modifying expenses
- deleting expenses
- finding purchases
- product recommendations
- general spending analysis

This tool delegates the request to the specialized Budget Agent.
`,
  inputSchema:  agenticToolInputSchema.describe(
    "The plain text user's budget-related request. User's budget message should be passed as input to this tool.",
  ),
  outputSchema: agenticToolOutputSchema,
  execute: async (input, context) => {
    return await executeAgenticTool(input, context, "budgetAgent");
  }
});
