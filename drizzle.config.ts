import "dotenv/config";
import { defineConfig } from "drizzle-kit";
export default defineConfig({
  schema: "src/db/schema/*.ts",
  out: "./drizzle",
  dialect: "postgresql",

  migrations: {
    table: "__drizzle_migrations",
    schema: "drizzle",
  },

  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});