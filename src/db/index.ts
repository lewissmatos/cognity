import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as expensesSchema from "./schema/expenses";
import * as usersSchema from "./schema/users";
import * as budgetSchema from "./schema/budget";
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, {
  schema: {
    ...expensesSchema,
    ...usersSchema,
    ...budgetSchema,
  },
});