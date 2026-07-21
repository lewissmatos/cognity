import { sql, SQL } from "drizzle-orm";
import { pgTable, uuid, varchar, timestamp, bigint, text } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),

  telegramId: bigint("telegram_id", {
    mode: "number",
  })
    .notNull()
    .unique(),

  username: varchar("username", {
    length: 255,
  }),

  firstName: varchar("first_name", {
    length: 255,
  }),

  lastName: varchar("last_name", {
    length: 255,
  }),

  createdAt: timestamp("created_at").defaultNow().notNull(),

  updatedAt: timestamp("updated_at").defaultNow().notNull(),

  chatVersion: bigint("chat_version", {
    mode: "number",
  }).default(1).notNull(),

  fullName: text("full_name").generatedAlwaysAs(
    (): SQL => sql`${`${users.firstName} || ' ' || ${users.lastName}`.trim()}`
  ),
});
