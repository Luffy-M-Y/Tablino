import { migrate } from "drizzle-orm/node-postgres/migrator";
import { resolve } from "node:path";
import { openGuardedDatabase } from "./_database-guard";

async function main() {
  const { db, pool } = openGuardedDatabase();
  try {
    await migrate(db, { migrationsFolder: resolve(__dirname, "../migrations") });
  } finally {
    await pool.end();
  }
}

main().catch(() => {
  console.error("Échec de migration : lanceur gardé.");
  process.exitCode = 1;
});
