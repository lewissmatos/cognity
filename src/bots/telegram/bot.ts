import { MastraModelOutput } from "@mastra/core/stream";
import { mastra } from "../../mastra/index.ts";
import {
  POLL_TIMEOUT_SECONDS,
  RETRY_DELAY_MS,
  TELEGRAM_API_BASE,
  TELEGRAM_BOT_TOKEN,
} from "./constants.ts";
import type { TelegramGetUpdatesResponse, TelegramUpdate } from "./types.ts";
import {
  isToolEvent,
  sendErrorMessage,
  sendTelegramMessage,
  toAgentInput,
  toToolDoneMessage,
  toToolStartMessage,
} from "./utils.ts";
import type { ToolName } from "../../mastra/tools/types.ts";

if (!TELEGRAM_BOT_TOKEN) {
  throw new Error("TELEGRAM_BOT_TOKEN is required to run the Telegram bot");
}

async function processUpdate(update: TelegramUpdate): Promise<void> {
  const parsed = toAgentInput(update);
  if (!parsed) {
    return;
  }

  const { chatId, prompt } = parsed;
  const threadId = `telegram-chat-${chatId}`;
  const resourceId = `telegram-user-${update.message?.from?.id ?? chatId}`;

  const agent = mastra.getAgent("cogassyAgent");

  try {
    const stream = await agent.stream(prompt, {
      memory: {
        thread: threadId,
        resource: resourceId,
      },
      maxSteps: 5,
    });
    await trackTools(stream, chatId);

    process.stdout.write("[Final Result]\n");

    const finalResult = await stream.text;

    process.stdout.write(`${finalResult}\n`);

    if (finalResult?.trim()) {
      await sendTelegramMessage(chatId,  `🚀 *Result:*\n${finalResult.trim()}`,);
    };
     

  } catch (error) {
    await sendErrorMessage(chatId, error);
  }
}

async function pollTelegramUpdates(): Promise<void> {
  let offset = Number(process.env.TELEGRAM_POLL_START_OFFSET ?? 0);

  process.stdout.write(
    `${new Date().toISOString()} - Telegram bot polling started with timeout=${POLL_TIMEOUT_SECONDS}s\n`,
  );

  while (true) {
    try {
      const params = new URLSearchParams({
        timeout: String(POLL_TIMEOUT_SECONDS),
        offset: String(offset),
        allowed_updates: JSON.stringify(["message"]),
      });

      const response = await fetch(
        `${TELEGRAM_API_BASE}/getUpdates?${params.toString()}`,
      );

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`getUpdates failed (${response.status}): ${body}`);
      }

      const payload = (await response.json()) as TelegramGetUpdatesResponse;

      if (!payload.ok) {
        throw new Error(payload.description ?? "Unknown Telegram API error");
      }

      for (const update of payload.result) {
        offset = update.update_id + 1;
        await processUpdate(update);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stdout.write(
        `${new Date().toISOString()} - Polling error: ${message}. Retrying in ${RETRY_DELAY_MS}ms\n`,
      );
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
}

async function trackTools(
  stream: MastraModelOutput<undefined>,
  chatId: string,
) {
  const notifiedToolStarts = new Set<string>();
  const inProgressToolCalls = new Map<string, ToolName>();
  const notifiedToolCompletions = new Set<string>();

  let currentReasoningId: string | null = null;
  let reasoningBuffer = "";
  let textBuffer = "";
  let lastSendTime = Date.now();

  const flushTextBuffer = async () => {
    const cleanText = textBuffer.trim();
    // TODO: Check this
    if (cleanText) {
      const formattedText = cleanText.replace(/\n+$/, "");
      await sendTelegramMessage(chatId, `💭 *Thinking:* ${formattedText}`);
      textBuffer = "";
      lastSendTime = Date.now();
    }
  };

  const flushReasoningSummaryBlock = async () => {
    const rawReasoning = reasoningBuffer.trim();
    if (!rawReasoning) return;

    try {
      const agent = mastra.getAgent("summarizeReasoningAgent");

      const summaryResult = await agent.generate(
        `
          You are an internal text-summarization subroutine for an AI assistant.
          Analyze this raw internal reasoning monologue and summarize the core technical issue or next step into 1-2 (max 3 if required), concise, professional sentences starting with an action verb.
          Remove all internal meta-commentary, code brackets, or personal corrections (like "Wait, let me try...").
          
          Raw reasoning data: "${rawReasoning}"
          
          Output only the summarized sentence. No pleasantries, no markdown prefix.
        `,
      );

      const cleanSummary = summaryResult.text.trim();
      if (!!cleanSummary) {
        await sendTelegramMessage(
          chatId,
          `🧠 *Reasoning Summary:*\n_${cleanSummary}_`,
        );
      }

    } catch (e) {
      const safetyFallback =
        rawReasoning.length > 120
          ? `${rawReasoning.slice(0, 120)}...`
          : rawReasoning;
      await sendTelegramMessage(chatId, `🧠 *Reasoning:* ${safetyFallback}`);
    } finally {
      reasoningBuffer = ""; // Reset buffer completely
      currentReasoningId = null; // Clear active ID tracking
      lastSendTime = Date.now();
    }
  };
  type MastraStreamPart = {
    type: string;
    payload?: {
      text?: string;
      id?: string;
    };
  };

  for await (const part of stream.fullStream) {
    const typedPart = part as unknown as MastraStreamPart;

    if (typedPart.type === "reasoning-delta" && typedPart.payload?.text) {
      const incomingId = typedPart.payload.id ?? "default-reasoning-id";

      // CRITICAL: If the ID changes mid-stream, flush the previous block first!
      if (currentReasoningId !== null && currentReasoningId !== incomingId) {
        process.stdout.write(
          `[Reasoning] ID changed from ${currentReasoningId} to ${incomingId}. Flushing old buffer.\n`,
        );
        await flushReasoningSummaryBlock();
      }

      currentReasoningId = incomingId;
      reasoningBuffer += typedPart.payload.text;
      continue;
    }

    if (part.type === "reasoning-end") {
      await flushReasoningSummaryBlock();
      continue;
    }

    if (!isToolEvent(part)) {
      continue;
    }

    const { toolCallId, toolName } =
      (part as {
        toolCallId?: string;
        toolName?: ToolName;
      }) ||
      part?.payload ||
      {};

    if (part.type === "start") {
      await sendTelegramMessage(chatId, "🤖💭…");
    }

    if (
      ["tool-call", "tool-call-delta"].includes(part.type) &&
      toolCallId &&
      toolName &&
      !notifiedToolStarts.has(toolCallId)
    ) {
      await flushTextBuffer();

      notifiedToolStarts.add(toolCallId);
      inProgressToolCalls.set(toolCallId, toolName);
      await sendTelegramMessage(chatId, toToolStartMessage(toolName));
      continue;
    }

    if (part.type === "tool-result" && toolCallId) {
      const resolvedToolName = toolName ?? inProgressToolCalls.get(toolCallId);

      if (!resolvedToolName) {
        continue;
      }

      if (notifiedToolCompletions.has(toolCallId)) {
        continue;
      }

      notifiedToolCompletions.add(toolCallId);
      inProgressToolCalls.delete(toolCallId);
      await sendTelegramMessage(chatId, toToolDoneMessage(resolvedToolName));
    }
  }

  await flushTextBuffer();
  await flushReasoningSummaryBlock(); // Catch any loose un-flushed reasoning
}

if (process.env.TELEGRAM_BOOTSTRAP_ONLY === "1") {
  process.stdout.write(
    `${new Date().toISOString()} - Telegram bot bootstrap check completed\n`,
  );
} else {
  await pollTelegramUpdates();
}
