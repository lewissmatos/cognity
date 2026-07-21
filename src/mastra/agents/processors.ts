import {
  ProcessInputArgs,
  ProcessInputStepArgs,
  Processor,
  ProcessOutputResultArgs,
} from "@mastra/core/processors";

export const MAX_AGENT_STEPS = 10;
export class IncomingMessageLoggerProcessor implements Processor {
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

export class AgentActionLoggerProcessor implements Processor {
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

export class EnsureTelegramFinalResponseProcessor implements Processor {
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
