import { mastra } from "@/mastra";
import { ToolExecutionContext, ValidationError } from "@mastra/core/tools";
import { z } from "zod";

export const agenticToolInputSchema = z.object({
  userInputMessage: z
    .string()
    .describe(
      "The plain text user's request. User's message should be passed as input to this tool.",
    ),
});

export const agenticToolOutputSchema = z.object({
  agentResponse: z
    .string()
    .describe(
      "The plain text response from the specialized agent, which is the final output to be returned to the user.",
    ),
});

export const executeAgenticTool = async (
  inputText: z.infer<typeof agenticToolInputSchema>,
  context: ToolExecutionContext,
  agentName: "expenseAgent" | "budgetAgent",
): Promise<
  z.infer<typeof agenticToolOutputSchema> | ValidationError | void
> => {
  const expenseAgent = mastra.getAgent(agentName);

  const threadId = context?.agent?.threadId;
  const resourceId = context?.agent?.resourceId;

  if (!threadId || !resourceId) {
    throw new Error("Thread ID or Resource ID is missing in the context.");
  }

  const memory = {
    thread: {
      id: threadId,
      resourceId,
    },
    resource: resourceId,
  };

  process.stdout.write(
    `${new Date().toISOString()} - ${agentName} Tool invoked with input: ${JSON.stringify(
      inputText,
    )}\n`,
  );

  const result = await expenseAgent.generate(inputText.userInputMessage, {
    memory,
  });

  const response = result.text;
  return {
    agentResponse: response,
  };
};
