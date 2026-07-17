import { db } from "@/db/index.ts";
import { users } from "@/db/schema/users";

export type CreateUserInput = typeof users.$inferInsert;
export class UserService {
  async createUser(data: CreateUserInput) {
    const [user] = await db
      .insert(users)
      .values({
        telegramId: data.telegramId,
        firstName: data.firstName,
        lastName: data.lastName,
        username: data.username,
      })
      .returning();

    return user;
  }

  async getUser(id: string) {
    const user = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.id, id),
    });

    return user;
  }

 async getUserByTelegramId(telegramId: number) {
  try {
    const user = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.telegramId, telegramId),
    });

    return user;
  } catch (error) {
    console.error("GET USER ERROR:", error);
    throw error;
  }
}

  async getOrCreateTelegramUser(data: CreateUserInput) {
   
    const user = await this.getUserByTelegramId(data.telegramId ?? "");

    if (!user) {
      const newUser = await this.createUser(data);
      return newUser;
    }

    return user;
  }
}

export const userService = new UserService();
