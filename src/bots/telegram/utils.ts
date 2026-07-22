import { TELEGRAM_API_BASE, TELEGRAM_PARSE_MODE } from "./constants.ts";
import type { StreamToolEvent, TelegramUpdate } from "./types.ts";
import type {  ToolName } from "../../mastra/tools/types.ts";

function normalizeMarkdownForTelegram(text: string): string {
  const normalizedText = text.replace(/\r\n?/g, "\n").trim();

  const normalizedLines = normalizedText
    .split("\n")
    .map((line) => {
      const headingMatch = line.match(/^\s{0,3}#{1,6}\s+(.+?)\s*$/);
      if (headingMatch) {
        return `*${headingMatch[1]}*`;
      }

      if (/^(\s*[-*_]\s*){3,}$/.test(line)) {
        return "──────────";
      }

      return line;
    })
    .join("\n");

  return normalizedLines
    .replace(/\*\*(.+?)\*\*/g, "*$1*")
    .replace(/^\*\s+/gm, "- ")
    .trim();
}

async function sendTelegramMessage(
  chatId: string,
  text: string,
): Promise<void> {
  const telegramMarkdownText = normalizeMarkdownForTelegram(text);

  const basePayload = {
    chat_id: chatId,
    text: telegramMarkdownText,
    disable_web_page_preview: true,
  };

  const markdownResponse = await fetch(`${TELEGRAM_API_BASE}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...basePayload,
      parse_mode: TELEGRAM_PARSE_MODE,
    }),
  });

  if (markdownResponse.ok) {
    return;
  }

  const markdownBody = await markdownResponse.text();

  process.stdout.write(`sendTelegramMessage - markdownBody: ${markdownBody}\n`);
  if (
    markdownResponse.status === 400 &&
    markdownBody.toLowerCase().includes("can't parse entities")
  ) {
    process.stdout.write(
      `${new Date().toISOString()} - Telegram Markdown parse failed; retrying without parse mode for chat ${chatId}\n`,
    );

    const plainResponse = await fetch(`${TELEGRAM_API_BASE}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(basePayload),
    });

    if (plainResponse.ok) {
      return;
    }

    const plainBody = await plainResponse.text();
    throw new Error(
      `Telegram sendMessage failed (${plainResponse.status}): ${plainBody}`,
    );
  }

  throw new Error(
    `Telegram sendMessage failed (${markdownResponse.status}): ${markdownBody}`,
  );
}

const toToolStartMessage = (toolName: ToolName): string => {
  const toolMessages: Record<ToolName, string> = {
    expenseAgenticTool: "🧾 Managing your expenses...",
    budgetAgenticTool: "📊 Checking your budget...",
  };

  return (
    toolMessages[toolName] || `I’m using *${toolName}* to process your request…`
  );
};

const toToolDoneMessage = (toolName: ToolName): string =>
  `Finished *${toolName}*. I’m now preparing your answer.`;

function isToolEvent(part: unknown): part is StreamToolEvent {
  if (!part || typeof part !== "object") {
    return false;
  }

  return "type" in part;
}

function telegramToConversationInput(
  update: TelegramUpdate,
): { chatId: string; prompt: string } | null {
  const message = update.message;
  if (!message || !message.text?.trim()) {
    return null;
  }

  if (message.from?.is_bot) {
    return null;
  }

  const chatId = String(message.chat.id);
  const userName = [message.from?.first_name, message.from?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  const prompt = [
    "[SYSTEM METADATA]",
    `chatId: ${chatId}`,
    `telegramUserId: ${message.from?.id ?? "unknown"}`,
    `telegramUsername: ${message.from?.username ?? "unknown"}`,
    `telegramUserName: ${userName || "unknown"}`,
    `telegramChatType: ${message.chat.type}`,
    `telegramMessageId: ${message.message_id}`,
    `telegramMessageDate: ${new Date(message.date * 1000).toISOString()}`,
    "[/SYSTEM METADATA]",
    "",
    message.text,
  ].join("\n");

  return { chatId, prompt };
}

async function sendErrorMessage(chatId: string, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  process.stdout.write(
    `[Error]: ${new Date().toISOString()} - Telegram bot error for chat ${chatId}: ${message}\n`,
  );

  await sendTelegramMessage(
    chatId,
    "I ran into an internal error while processing your message. Please try again in a moment.",
  );
}

export {
  normalizeMarkdownForTelegram,
  sendTelegramMessage,
  isToolEvent,
  telegramToConversationInput,
  toToolStartMessage,
  toToolDoneMessage,
  sendErrorMessage,
};
