import { config } from "dotenv";
import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/schema";
import { assertAllowedDatabaseTarget } from "./database-guard-validation";

export { assertAllowedDatabaseTarget, selectDatabaseUrl, validateDatabaseTarget } from "./database-guard-validation";

function loadAndValidateTestUrl(): string {
  config({ path: resolve(__dirname, "../.env.test"), override: false });
  const connectionString = process.env.DATABASE_URL;
  assertAllowedDatabaseTarget(connectionString);
  return connectionString;
}

/** Validates the configured target before constructing any Pool. */
export function openGuardedDatabase() {
  const connectionString = loadAndValidateTestUrl();
  const pool = new Pool({ connectionString });
  return { db: drizzle(pool, { schema }), pool };
}
