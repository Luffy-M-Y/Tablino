import { asc, count, eq, inArray, or, sql, type SQL } from "drizzle-orm";
import * as schema from "../src/schema";
import { openGuardedDatabase } from "./_database-guard";

const SQL_MARKER_PATTERN = "^ZZ[A-Z]{12}$";
const JS_MARKER_PATTERN = /^ZZ[A-Z]{12}$/;
const FAKE_MARKERS = [
  "ZZABCDEFGHIJKLX",
  "ZZABCDEFGHIJK",
  "ZZABCDEFGHIJK1",
] as const;

type DbContext = ReturnType<typeof openGuardedDatabase>;
type ParentIds = { universityIds: string[]; programIds: string[]; cycleIds: string[] };
type Counts = {
  universities: number;
  programs: number;
  cycles: number;
  program_cycles: number;
  levels: number;
};
type MigrationRow = { hash: unknown; created_at: unknown };
type UniversitySummary = { id: string; slug: string; programs: number; cycles: number };
type AuthCounts = { users: number; accounts: number; sessions: number };

async function countQuery(query: Promise<{ count: number }[]>): Promise<number> {
  const [row] = await query;
  return Number(row?.count ?? 0);
}

async function readUniversitySummaries(
  tx: Parameters<Parameters<DbContext["db"]["transaction"]>[0]>[0],
): Promise<UniversitySummary[]> {
  const universities = await tx.select({
    id: schema.universities.id,
    slug: schema.universities.slug,
  }).from(schema.universities).orderBy(asc(schema.universities.slug));
  const summaries: UniversitySummary[] = [];

  for (const university of universities) {
    const programs = await countQuery(tx.select({ count: count() }).from(schema.programs)
      .where(eq(schema.programs.universityId, university.id)));
    const cycles = await countQuery(tx.select({ count: count() }).from(schema.cycles)
      .where(eq(schema.cycles.universityId, university.id)));
    summaries.push({ ...university, programs, cycles });
  }
  return summaries;
}

async function readAuthCounts(
  tx: Parameters<Parameters<DbContext["db"]["transaction"]>[0]>[0],
): Promise<AuthCounts> {
  return {
    users: await countQuery(tx.select({ count: count() }).from(schema.users)),
    accounts: await countQuery(tx.select({ count: count() }).from(schema.accounts)),
    sessions: await countQuery(tx.select({ count: count() }).from(schema.sessions)),
  };
}

async function checkProcessUniversityId(
  tx: Parameters<Parameters<DbContext["db"]["transaction"]>[0]>[0],
): Promise<boolean | null> {
  const universityId = process.env.UNIVERSITY_ID;
  if (universityId === undefined) return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(universityId)) {
    return false;
  }
  const [university] = await tx.select({ id: schema.universities.id })
    .from(schema.universities)
    .where(eq(schema.universities.id, universityId))
    .limit(1);
  return Boolean(university);
}

function relationFilter(
  programColumn: typeof schema.levels.programId | typeof schema.programCycles.programId,
  cycleColumn: typeof schema.levels.cycleId | typeof schema.programCycles.cycleId,
  parents: ParentIds,
): SQL | undefined {
  const conditions: SQL[] = [];
  if (parents.programIds.length) conditions.push(inArray(programColumn, parents.programIds));
  if (parents.cycleIds.length) conditions.push(inArray(cycleColumn, parents.cycleIds));
  return conditions.length ? or(...conditions) : undefined;
}

async function readParentIds(
  tx: Parameters<Parameters<DbContext["db"]["transaction"]>[0]>[0],
  whereMarker: (column: typeof schema.universities.slug | typeof schema.programs.slug | typeof schema.cycles.name) => SQL,
): Promise<ParentIds> {
  const universities = await tx.select({ id: schema.universities.id }).from(schema.universities)
    .where(whereMarker(schema.universities.slug));
  const programs = await tx.select({ id: schema.programs.id }).from(schema.programs)
    .where(whereMarker(schema.programs.slug));
  const cycles = await tx.select({ id: schema.cycles.id }).from(schema.cycles)
    .where(whereMarker(schema.cycles.name));
  return {
    universityIds: universities.map(({ id }) => id),
    programIds: programs.map(({ id }) => id),
    cycleIds: cycles.map(({ id }) => id),
  };
}

async function countRows(
  tx: Parameters<Parameters<DbContext["db"]["transaction"]>[0]>[0],
  parents: ParentIds,
  whereMarker: (column: typeof schema.universities.slug | typeof schema.programs.slug | typeof schema.cycles.name) => SQL,
): Promise<Counts> {
  const levelRelations = relationFilter(schema.levels.programId, schema.levels.cycleId, parents);
  const programCycleRelations = relationFilter(
    schema.programCycles.programId,
    schema.programCycles.cycleId,
    parents,
  );
  const universities = await countQuery(tx.select({ count: count() }).from(schema.universities)
    .where(whereMarker(schema.universities.slug)));
  const programs = await countQuery(tx.select({ count: count() }).from(schema.programs)
    .where(whereMarker(schema.programs.slug)));
  const cycles = await countQuery(tx.select({ count: count() }).from(schema.cycles)
    .where(whereMarker(schema.cycles.name)));
  const programCycles = programCycleRelations
    ? await countQuery(tx.select({ count: count() }).from(schema.programCycles).where(programCycleRelations))
    : 0;
  const levels = levelRelations
    ? await countQuery(tx.select({ count: count() }).from(schema.levels).where(levelRelations))
    : 0;
  return { universities, programs, cycles, program_cycles: programCycles, levels };
}

function total(counts: Counts): number {
  return Object.values(counts).reduce((sum, value) => sum + value, 0);
}

function format(counts: Counts): string {
  return `universities=${counts.universities} programs=${counts.programs} cycles=${counts.cycles} program_cycles=${counts.program_cycles} levels=${counts.levels}`;
}

function formatDate(value: unknown): string {
  const date = value instanceof Date
    ? value
    : typeof value === "number" || (typeof value === "string" && /^\d{10,}$/.test(value))
      ? new Date(Number(value))
      : new Date(String(value));
  return Number.isNaN(date.getTime()) ? "invalid" : date.toISOString();
}

async function inspect(db: DbContext["db"]) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SET TRANSACTION READ ONLY`);

    const readOnlyState = await tx.execute(sql`SELECT current_setting('transaction_read_only') AS value`);
    if (readOnlyState.rows[0]?.value !== "on") throw new Error("READ_ONLY_REQUIRED");

    const universities = await readUniversitySummaries(tx);
    const authCounts = await readAuthCounts(tx);
    const processUniversityIdExists = await checkProcessUniversityId(tx);

    const validMarker = (column: typeof schema.universities.slug | typeof schema.programs.slug | typeof schema.cycles.name) =>
      sql`${column} ~ ${SQL_MARKER_PATTERN}`;
    const validParents = await readParentIds(tx, validMarker);
    const validCounts = await countRows(tx, validParents, validMarker);

    const fakeMarker = (column: typeof schema.universities.slug | typeof schema.programs.slug | typeof schema.cycles.name) =>
      inArray(column, [...FAKE_MARKERS]);
    const fakeParents = await readParentIds(tx, fakeMarker);
    const fakeCounts = await countRows(tx, fakeParents, fakeMarker);

    const migrationTable = await tx.execute(sql`SELECT to_regclass('drizzle.__drizzle_migrations')::text AS table_name`);
    if (!migrationTable.rows[0]?.table_name) {
      return {
        validCounts,
        fakeCounts,
        migrations: null as MigrationRow[] | null,
        universities,
        authCounts,
        processUniversityIdExists,
      };
    }

    const migrationResult = await tx.execute(sql`SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at`);
    return {
      validCounts,
      fakeCounts,
      migrations: migrationResult.rows as MigrationRow[],
      universities,
      authCounts,
      processUniversityIdExists,
    };
  });
}

async function main(): Promise<void> {
  if (FAKE_MARKERS.some((marker) => JS_MARKER_PATTERN.test(marker))) {
    process.stdout.write("ECHEC FAUX_MARQUEURS_INVALIDES\n");
    process.exitCode = 1;
    return;
  }

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
    process.stdout.write(`UNIVERSITIES=${result.universities.length}\n`);
    for (const university of result.universities) {
      process.stdout.write(
        `UNIVERSITY id=${university.id} slug=${university.slug} programs=${university.programs} cycles=${university.cycles}\n`,
      );
    }
    process.stdout.write(
      `AUTH_COUNTS users=${result.authCounts.users} accounts=${result.authCounts.accounts} sessions=${result.authCounts.sessions}\n`,
    );
    process.stdout.write(
      `UNIVERSITY_ID_IN_XBLAPZ=${result.processUniversityIdExists === null ? "INCONNU" : result.processUniversityIdExists}\n`,
    );
    process.stdout.write(`ZZ ${format(result.validCounts)} total=${total(result.validCounts)}\n`);
    process.stdout.write(`FAUX_MARQUEURS ${format(result.fakeCounts)} total=${total(result.fakeCounts)}\n`);
    if (result.migrations === null) {
      process.stdout.write("MIGRATIONS=absent\n");
    } else {
      process.stdout.write(`MIGRATIONS=${result.migrations.length}\n`);
      for (const migration of result.migrations) {
        const hash = typeof migration.hash === "string" ? migration.hash.slice(0, 8) : "invalid";
        process.stdout.write(`MIGRATION hash=${hash} created_at=${formatDate(migration.created_at)}\n`);
      }
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
