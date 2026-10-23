import { count, eq, sql } from "drizzle-orm";
import * as schema from "../src/schema";
import { openGuardedDatabase } from "./_database-guard";

type DbContext = ReturnType<typeof openGuardedDatabase>;

async function inspect(db: DbContext["db"]) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SET TRANSACTION READ ONLY`);

    const readOnlyState = await tx.execute(sql`SELECT current_setting('transaction_read_only') AS value`);
    if (readOnlyState.rows[0]?.value !== "on") throw new Error("READ_ONLY_REQUIRED");

    const [totalRow] = await tx.select({ total: count() }).from(schema.resources);
    const drafts = await tx
      .select({
        id: schema.resources.id,
        universityId: schema.resources.universityId,
        subjectId: schema.resources.subjectId,
        uploadedBy: schema.resources.uploadedBy,
        title: schema.resources.title,
        format: schema.resources.format,
        fileKey: schema.resources.fileKey,
        fileSizeBytes: schema.resources.fileSizeBytes,
        status: schema.resources.status,
      })
      .from(schema.resources)
      .where(eq(schema.resources.status, "draft"));

    return { total: Number(totalRow?.total ?? 0), drafts };
  });
}

async function main(): Promise<void> {
  if (Object.hasOwn(process.env, "DATABASE_URL")) {
    process.stdout.write("ECHEC DATABASE_URL_PREEXISTANTE\n");
    process.exitCode = 1;
    return;
  }

  let dbContext: DbContext | undefined;
  let stage = "garde";
  try {
    dbContext = openGuardedDatabase();
    stage = "lecture";
    const result = await inspect(dbContext.db);
    process.stdout.write(`RESOURCES_TOTAL=${result.total}\n`);
    process.stdout.write(`RESOURCES_DRAFT=${result.drafts.length}\n`);
    for (const resource of result.drafts) {
      process.stdout.write(`RESOURCE ${JSON.stringify(resource)}\n`);
    }
  } catch (error) {
    const code = (error as { code?: unknown })?.code;
    const safeCode = typeof code === "string" && /^[A-Z0-9_]+$/.test(code) ? code : "inconnu";
    process.stdout.write(`ECHEC INSPECTION_GARDEE ETAPE=${stage} CODE=${safeCode}\n`);
    process.exitCode = 1;
  } finally {
    await dbContext?.pool.end().catch(() => {
      process.stdout.write("ECHEC FERMETURE_POOL\n");
      process.exitCode = 1;
    });
  }
}

void main();
