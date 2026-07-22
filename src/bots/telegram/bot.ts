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
  telegramToConversationInput,
  toToolDoneMessage,
  toToolStartMessage,
} from "./utils.ts";
import type { ToolName } from "../../mastra/tools/types.ts";
import { userService } from "@/services/users/user.service.ts";
import { MastraModelOutput } from "@mastra/core/stream";
import { MAX_AGENT_STEPS } from "../../mastra/agents/processors";
import { cogassyAgent } from "../../mastra/agents/router/cogassy/cogassy-agent.ts";

if (!TELEGRAM_BOT_TOKEN) {
  throw new Error("TELEGRAM_BOT_TOKEN is required to run the Telegram bot");
}

async function processUpdate(update: TelegramUpdate): Promise<void> {
  const parsed = telegramToConversationInput(update);
  if (!parsed) {
    return;
  }

  const { chatId, prompt } = parsed;
  const telegramUser = update.message?.from;

  const user = await userService.getOrCreateTelegramUser({
    telegramId: Number(telegramUser?.id ?? chatId),
    username: telegramUser?.username,
    firstName: telegramUser?.first_name,
    lastName: telegramUser?.last_name,
  });

  const text = update.message?.text?.trim() ?? "";
  if (text === "/newchat" || text === "/reset") {
    try {
      const currentStatus = await userService.resetUserChatVersion(user.id);

      process.stdout.write(
        `${new Date().toISOString()} - Resetting chat for userId=${user.id}, chatId=${chatId}, newChatVersion=${currentStatus.chatVersion}\n`,
      );
      await sendTelegramMessage(
        chatId,
        "✨\n".repeat(3) +
          `He olvidado todo lo anterior.\n Cuentame *${currentStatus.fullName}* ¿En qué puedo ayudarte?`,
      );
      return;
    } catch (error) {
      await sendErrorMessage(chatId, error);
      return;
    }
  }

  process.stdout.write(
    `${new Date().toISOString()} - Processing update for chatId=${chatId}, userId=${user?.id}\name=${user?.fullName}\n`,
  );

  const chatVersion = user?.chatVersion ?? 1;
  const threadId = `telegram-chat-${chatId}-v${chatVersion}`;
  const resourceId = user?.id;

  try {
    const memory = {
      thread: {
        id: threadId,
        resourceId,
      },
      resource: resourceId,
    };

    const stream = await cogassyAgent.stream(prompt, {
      memory,
      maxSteps: MAX_AGENT_STEPS,
    });

    await trackTools(stream, chatId);

    const finalResult = await stream.text;

    process.stdout.write(`[Final Result]: ${finalResult}\n`);

    if (!!finalResult?.trim()) {
      await sendTelegramMessage(chatId, `${finalResult.trim()}`);
    } else {
      const briefSummary = await cogassyAgent.generate(
        "The agent did not produce any output. Please provide a brief summary of the issue or next steps.",
        { memory },
      );
      await sendTelegramMessage(chatId, `${briefSummary.text.trim()}`);
    }
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
      const summarizeReasoningAgent = mastra.getAgent(
        "summarizeReasoningAgent",
      );

      const prompt = `
          You are an internal text-summarization subroutine for an AI assistant.
          Analyze this raw internal reasoning monologue and summarize the core technical issue or next step into 1-2 (max 3 if required), concise, professional sentences starting with an action verb.
          Remove all internal meta-commentary, code brackets, or personal corrections (like "Wait, let me try...").
          
          Raw reasoning data: "${rawReasoning}"
          
          Output only the summarized sentence. No pleasantries, no markdown prefix.
        `;
      const summaryResult = await summarizeReasoningAgent.generate(prompt);

      const cleanSummary = summaryResult.text.trim();
      if (!!cleanSummary) {
        await sendTelegramMessage(chatId, `_${cleanSummary}_`);
      }
    } catch (e) {
      const safetyFallback =
        rawReasoning.length > 120
          ? `${rawReasoning.slice(0, 120)}...`
          : rawReasoning;
      await sendTelegramMessage(chatId, `${safetyFallback}`);
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
      toolCallId?: string;
      toolName?: ToolName;
      args?: Record<string, unknown>;
    };
  };

  for await (const part of stream.fullStream) {
    const typedPart = part as unknown as MastraStreamPart;

    if (!isToolEvent(part)) {
      continue;
    }

    const { payload, type } = typedPart;

    const toolCallId = payload?.toolCallId;
    const toolName = payload?.toolName;

    if (
      ["tool-call", "tool-call-delta"].includes(part.type) &&
      toolCallId &&
      toolName &&
      !notifiedToolStarts.has(toolCallId)
    ) {
      process.stdout.write(
        `[Tool Call]: ${JSON.stringify(typedPart, null, 2)}\n`,
      );

      await flushTextBuffer();

      notifiedToolStarts.add(toolCallId);
      inProgressToolCalls.set(toolCallId, toolName);
      await sendTelegramMessage(chatId, toToolStartMessage(toolName));
      continue;
    }

    if (type === "reasoning-delta" && !!typedPart.payload?.text) {
      const incomingId = typedPart.payload.id ?? "default-reasoning-id";

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

    if (type === "reasoning-end") {
      await flushReasoningSummaryBlock();
      continue;
    }

    if (type === "start") {
      await sendTelegramMessage(chatId, "🤖💭…");
    }

    if (type === "tool-result" && toolCallId) {
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
  await flushReasoningSummaryBlock();
}

await pollTelegramUpdates();
