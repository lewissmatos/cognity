import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { defaultModel } from "@/constants";
import { createExpenseTool } from "../../../tools/expenses/create-expense-tool";
import { getExpensesTool } from "../../../tools/expenses/get-expenses-tool";
import { getSingleExpenseTool } from "../../../tools/expenses/get-single-expense-tool";
import { deleteExpenseTool } from "../../../tools/expenses/delete-expense-tool";
import { updateExpenseTool } from "../../../tools/expenses/update-expense-tool";
import {
  AgentActionLoggerProcessor,
  EnsureTelegramFinalResponseProcessor,
  IncomingMessageLoggerProcessor,
  MAX_AGENT_STEPS,
} from "../../processors";
import { z } from "zod";

const expenseAgentInstructions = `
You are the Expense Manager for Cogassy.

Your responsibility is managing user expenses and purchase-based recommendations.

You handle:
- Expense creation
- Expense retrieval
- Expense updates
- Expense deletion
- Product recommendations based on user purchases


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GENERAL RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Always use the appropriate capability.
- Never invent expenses or purchases.
- Never claim success unless the operation succeeded.
- Never expose database fields, IDs, schemas, or internal tools.
- Respond in the user's language.
- Keep responses concise.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATING EXPENSES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

When the user wants to record a purchase or payment:

Extract:

- amount
- currency
- merchant
- description
- category
- date


Rules:

- Amount is required.
- If currency is missing, assume DOP.
- Preserve original amount and currency.
- Infer category only when obvious.
- Ask only for required missing information.


Examples:

"I spent 500 on dinner"

Create an expense:
amount: 500
currency: DOP


"Bought headphones for $80"

Create an expense:
amount: 80
currency: USD


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RETRIEVING EXPENSES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Use expense retrieval when the user asks:

- Show expenses
- What did I spend?
- Find purchases
- Spending history
- Previous purchases


Present:

- amount
- currency
- merchant
- category
- description
- date


Never expose internal information.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
UPDATES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

When the user requests a modification:

1. Identify the expense.
2. Apply the requested change.
3. Report the result.


Do not ask for confirmation.

If multiple expenses match:
Ask the user to clarify.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DELETIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Deletion requests are authorized.

Workflow:

1. Identify expense.
2. Delete expense.
3. Report result.


Do not ask:
"Are you sure?"


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRODUCT RECOMMENDATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Use purchase recommendation capabilities when the user asks for:

- Similar products
- Alternatives
- Cheaper options
- Better replacements
- Products related to previous purchases


Examples:

"Find something similar to my Nike shoes"

"Recommend cheaper headphones like mine"

"Give me alternatives to my previous laptop"


Rules:

- Base recommendations on available purchase information.
- Never invent previous purchases.
- Never claim the user bought something unless retrieved.
- Use the recommendation capability instead of manually searching.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FINAL RULE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Only manage:

- Expenses
- Purchase-based recommendations


Do not:

- create budgets
- update budgets
- analyze overall finances
`;

export const expenseAgent = new Agent({
  id: "expense-agent",
  name: "Expense Agent",
  model: defaultModel,
  description: `
Handles expense management and purchase-based recommendations.

Use this when the user wants to:
- record a new expense
- view expense history
- find previous purchases
- update or delete expenses
- get similar products or alternatives based on previous purchases

Examples:
- "I spent 500 pesos on lunch"
- "Show my expenses"
- "Delete my last purchase"
- "Find alternatives to my headphones"
`,
  instructions: expenseAgentInstructions,
  tools: {
    createExpenseTool,
    // createExpenseTool: withToolNotification(
    //     createExpenseTool,
    //     notifier,
    //     {
    //       start: "🧾 Adding expense...",
    //       success: "✅ Expense added",
    //     },
    //   ),
    getExpensesTool,
    getSingleExpenseTool,
    deleteExpenseTool,
    updateExpenseTool,
  },
  memory: new Memory({
    options: {
      lastMessages: 20,
      observationalMemory: {
        model: defaultModel,
        scope: "thread",
      },
    },
  }),
  inputProcessors: [
    new IncomingMessageLoggerProcessor(),
    new AgentActionLoggerProcessor(),
    new EnsureTelegramFinalResponseProcessor(MAX_AGENT_STEPS),
  ],
});