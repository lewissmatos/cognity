export type StreamToolEvent = {
  type: "tool-call" | "tool-result" | "start";
  toolCallId?: string;
  toolName?: string;
};

export type TelegramUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    date: number;
    text?: string;
    chat: {
      id: number;
      type: string;
      username?: string;
      first_name?: string;
      last_name?: string;
    };
    from?: {
      id: number;
      is_bot: boolean;
      username?: string;
      first_name?: string;
      last_name?: string;
      language_code?: string;
    };
  };
};

export type TelegramGetUpdatesResponse = {
  ok: boolean;
  result: TelegramUpdate[];
  description?: string;
};

