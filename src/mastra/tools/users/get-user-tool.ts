import { users } from "@/db/schema/users";
import { userService } from "@/services/expenses/user.service";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const inputSchema = z.object({
  userId: z.string().optional().describe("The ID of the user to retrieve."),
  userTelegramId: z
    .number()
    .optional()
    .describe("The Telegram ID of the user to retrieve."),
});

export const getUserTool = createTool({
  id: "get-user-tool",
  description:
    "A tool to retrieve user information from the database. Use this when you need to get details about a specific user based on their ID, Telegram ID, or full name.",
  inputSchema,
  outputSchema: z.object({
    isSuccessful: z.boolean(),
    data: z
      .object({
        id: z.string(),
        telegramId: z.number().optional().nullable(),
        username: z.string().optional().nullable(),
        firstName: z.string().optional().nullable(),
        lastName: z.string().optional().nullable(),
        fullName: z.string().optional().nullable(),
        createdAt: z.date(),
      })
      .optional()
      .nullable(),
    message: z.string().optional(),
  }),
  execute: async ({  userTelegramId },context) => {
    const userId = context?.agent?.resourceId;
    let user: typeof users.$inferInsert | undefined = undefined;
    if (!!userId) {
      user = await userService.getUser(userId);
    } else if (!!userTelegramId) {
      user = await userService.getUserByTelegramId(userTelegramId);
    } else {
      return {
        isSuccessful: false,
        data: null,
        message: "Either userId or userTelegramId must be provided.",
      };
    }

    if (!user) {
      return { isSuccessful: false, data: null, message: "User not found." };
    }

    const data = {
        ...user,
      } as Required<typeof user>;

    return {
      isSuccessful: true,
      data,
    };
  },
});
