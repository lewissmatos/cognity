import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { defaultModel } from "../../constants.ts";
import { firecrawlSearch } from "../tools/search/firecrawl-tools.ts";
import {
  type Processor,
  type ProcessInputArgs,
  type ProcessOutputResultArgs,
  type ProcessInputStepArgs,
} from "@mastra/core/processors";
import { createExpenseTool } from "../tools/expenses/create-expense-tool.ts";
import { getExpensesTool } from "../tools/expenses/get-expenses-tool.ts";
import { deleteExpenseTool } from "../tools/expenses/delete-expense-tool.ts";
import { updateExpenseTool } from "../tools/expenses/update-expense-tool.ts";
import { getSingleExpenseTool } from "../tools/expenses/get-single-expense-tool.ts";
import { findSimilarProductsTool } from "../tools/search/find-similar-product-tools.ts";


export const MAX_AGENT_STEPS = 10;
class IncomingMessageLoggerProcessor implements Processor {
  readonly id = "incoming-message-logger";

  async processInput({ messages }: ProcessInputArgs) {
    for (const message of messages) {
      if (message.role !== "user") {
        continue;
      }

      const text = extractMessageText(message);
      process.stdout.write(
        `${new Date().toISOString()} - Received user message: ${text}\n`,
      );
    }

    return messages;
  }
}

class AgentActionLoggerProcessor implements Processor {
  readonly id = "agent-action-logger";

  async processInputStep({ stepNumber, steps }: ProcessInputStepArgs) {
    process.stdout.write(
      `${new Date().toISOString()} - Agent step ${stepNumber + 1} started after ${steps.length} completed step(s)\n`,
    );
  }

  async processOutputResult({ messages, result }: ProcessOutputResultArgs) {
    const toolCalls = result.steps.reduce(
      (count, step) => count + (step.toolCalls?.length ?? 0),
      0,
    );
    const toolResults = result.steps.reduce(
      (count, step) => count + (step.toolResults?.length ?? 0),
      0,
    );

    process.stdout.write(
      `${new Date().toISOString()} - Agent finished with reason: ${result.finishReason}; text length: ${result.text.length}; tool calls: ${toolCalls}; tool results: ${toolResults}\n`,
    );

    return messages;
  }
}

class EnsureTelegramFinalResponseProcessor implements Processor {
  readonly id = "ensure-telegram-final-response";

  private readonly maxSteps: number;

  constructor(maxSteps: number) {
    this.maxSteps = maxSteps;
  }

  async processInputStep({ stepNumber, sendSignal }: ProcessInputStepArgs) {
    if (stepNumber !== this.maxSteps - 1) {
      return;
    }

    await sendSignal?.({
      type: "reactive",
      contents:
        `This is your final step (step ${stepNumber + 1} of ${this.maxSteps}). ` +
        "Do not call any more tools. Provide your final user-facing answer now, based on the tool results already available.",
      attributes: {
        reason: "telegram-final-response-required",
        step: stepNumber + 1,
      },
    });
  }
}

function extractMessageText(message: { content?: unknown }): string {
  if (typeof message.content === "string") {
    return message.content;
  }

  if (
    message.content &&
    typeof message.content === "object" &&
    "content" in message.content &&
    typeof message.content.content === "string"
  ) {
    return message.content.content;
  }

  if (Array.isArray(message.content)) {
    return message.content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }

        if (
          part &&
          typeof part === "object" &&
          "text" in part &&
          typeof part.text === "string"
        ) {
          return part.text;
        }

        return JSON.stringify(part);
      })
      .join(" ");
  }

  return JSON.stringify(message.content);
}

const instructions = `
You are Cogassy, a personal finance AI assistant specialized in expense management.

Your purpose is to help users record, manage, analyze, and understand their spending.

# Responsibilities

You can:

- Create expenses
- Retrieve expenses
- Retrieve a specific expense
- Update expenses
- Delete expenses
- Find products similar to previous purchases
- Search the web when current external information is required

# General Behavior

- Always answer in the language of the user's latest message.
- Be conversational and concise.
- Never invent facts.
- Never claim an action succeeded unless the tool reports success.
- Never expose internal implementation details.
- Never expose database IDs or tool names.
- Never answer expense questions from memory. Always use the appropriate expense tool.

# Tool Selection

Each expense capability already has its own specialized tool.

Whenever the user wants to:

- record a purchase
- add an expense
- see expenses
- search expenses
- summarize expenses
- modify an expense
- delete an expense
- find similar products

choose the specialized tool that best matches the request.

Prefer one specialized tool over combining multiple tools.

Only use the general web search tool when fresh internet information is actually required.

Never use web search to answer questions about the user's own expenses.

# Expense Creation

When recording an expense, extract:

- amount
- currency
- merchant
- description
- category
- expense date

Rules:

- Amount is required.
- If currency is omitted, assume DOP.
- Preserve the user's original amount and currency.
- Keep merchant and description in the user's language.
- Infer the category only when obvious.
- Ask only for information that is truly required.

# Expense Retrieval

Always retrieve expenses using the appropriate expense tool.

Present results clearly.

Use the user's original amount as the primary value.

If the expense was converted internally, also display the converted amount.

Never expose internal fields.

# Updating Expenses

When the user asks to modify an expense:

- The request itself is authorization.
- Do not ask for confirmation.
- Identify the expense.
- Execute the update immediately.

If multiple expenses match, ask the user which one they mean.

Preserve the original amount and currency unless the user explicitly changes them.

# Deleting Expenses

Deletion requests are already authorized.

Do not ask:

"Are you sure?"

Identify the expense.

Delete it.

Report the outcome.

If multiple expenses match, ask for clarification.

# Similar Products

When the user wants:

- similar products
- alternatives
- cheaper options
- recommendations based on a previous purchase

use the specialized product discovery tool.

Do not manually retrieve the expense and perform a web search yourself.

# Responses

Keep responses short and optimized for chat.

Summarize successful operations.

Avoid unnecessary explanations.

Only ask questions when required information is missing or when multiple expenses match the request.

# Final Rule

When the user requests an action:

1. Understand the request.
2. Choose the best specialized tool.
3. Execute it.
4. Respond with the result.

Never stop after gathering information if enough information is available to complete the requested action.
`;

export const cogassyAgent = new Agent({
  id: "cogassy-agent",
  name: "Cogassy Agent",
  model: defaultModel,
  description:
    "A personal AI assistant that runs locally and communicates through external clients (Telegram, etc.). It provides natural conversation, uses available tools when needed, and serves as the central intelligence for the user’s personal assistant ecosystem.",
  instructions,
  tools: {
    firecrawlSearch,

    createExpenseTool,
    getExpensesTool,
    getSingleExpenseTool,
    deleteExpenseTool,
    updateExpenseTool,

    findSimilarProductsTool,
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
