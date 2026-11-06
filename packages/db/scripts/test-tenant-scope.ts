import { randomBytes, randomUUID } from "node:crypto";
import { count, eq, inArray, or, sql, type SQL } from "drizzle-orm";
import * as schema from "../src/schema";
import { openGuardedDatabase } from "./_database-guard";

const SQL_MARKER_PATTERN = "^ZZ[A-Z]{12}$";
const JS_MARKER_PATTERN = /^ZZ[A-Z]{12}$/;
const CLEANUP_TIMEOUT_MS = 15_000;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const FAKE_MARKERS = [
  "ZZABCDEFGHIJKLX",
  "ZZABCDEFGHIJK",
  "ZZABCDEFGHIJK1",
] as const;

type DbContext = ReturnType<typeof openGuardedDatabase>;
type MarkerParents = { programIds: string[]; cycleIds: string[] };
type Counts = {
  universities: number;
  programs: number;
  cycles: number;
  program_cycles: number;
  levels: number;
};

let guardedDb: DbContext["db"] | undefined;
let guardPool: DbContext["pool"] | undefined;
let failed = false;
let interrupted = false;
let sigintHandled = false;
let finishPromise: Promise<void> | undefined;
let resolveSignalWait: (() => void) | undefined;

function randomLetters(length: number): string {
  const bytes = randomBytes(length);
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join("");
}

function createRunMarkers(): { universityA: string; universityB: string } {
  const suffix = randomLetters(11);
  const markers = { universityA: `ZZ${suffix}A`, universityB: `ZZ${suffix}B` };
  if (!Object.values(markers).every((marker) => JS_MARKER_PATTERN.test(marker))) {
    throw new Error("Invalid test marker");
  }
  return markers;
}

function parentIdFilter(
  programColumn: typeof schema.levels.programId | typeof schema.programCycles.programId,
  cycleColumn: typeof schema.levels.cycleId | typeof schema.programCycles.cycleId,
  parents: MarkerParents,
): SQL | undefined {
  const conditions: SQL[] = [];
  if (parents.programIds.length > 0) conditions.push(inArray(programColumn, parents.programIds));
  if (parents.cycleIds.length > 0) conditions.push(inArray(cycleColumn, parents.cycleIds));
  return or(...conditions);
}

async function findMarkedParents(db: DbContext["db"]): Promise<MarkerParents> {
  const [programRows, cycleRows] = await Promise.all([
    db.select({ id: schema.programs.id })
      .from(schema.programs)
      .where(sql`${schema.programs.slug} ~ ${SQL_MARKER_PATTERN}`),
    db.select({ id: schema.cycles.id })
      .from(schema.cycles)
      .where(sql`${schema.cycles.name} ~ ${SQL_MARKER_PATTERN}`),
  ]);
  return {
    programIds: programRows.map(({ id }) => id),
    cycleIds: cycleRows.map(({ id }) => id),
  };
}

async function countQuery(query: Promise<{ count: number }[]>): Promise<number> {
  const [row] = await query;
  return Number(row?.count ?? 0);
}

async function countMarkedRows(
  db: DbContext["db"],
  parents: MarkerParents,
): Promise<Counts> {
  const levelFilter = parentIdFilter(schema.levels.programId, schema.levels.cycleId, parents);
  const programCycleFilter = parentIdFilter(
    schema.programCycles.programId,
    schema.programCycles.cycleId,
    parents,
  );
  const [universities, programs, cycles, programCycles, levels] = await Promise.all([
    countQuery(db.select({ count: count() }).from(schema.universities)
      .where(sql`${schema.universities.slug} ~ ${SQL_MARKER_PATTERN}`)),
    countQuery(db.select({ count: count() }).from(schema.programs)
      .where(sql`${schema.programs.slug} ~ ${SQL_MARKER_PATTERN}`)),
    countQuery(db.select({ count: count() }).from(schema.cycles)
      .where(sql`${schema.cycles.name} ~ ${SQL_MARKER_PATTERN}`)),
    programCycleFilter
      ? countQuery(db.select({ count: count() }).from(schema.programCycles).where(programCycleFilter))
      : Promise.resolve(0),
    levelFilter
      ? countQuery(db.select({ count: count() }).from(schema.levels).where(levelFilter))
      : Promise.resolve(0),
  ]);
  return {
    universities,
    programs,
    cycles,
    program_cycles: programCycles,
    levels,
  };
}

function totalRows(counts: Counts): number {
  return Object.values(counts).reduce((total, value) => total + value, 0);
}

function formatCounts(counts: Counts): string {
  return `universities=${counts.universities} programs=${counts.programs} cycles=${counts.cycles} program_cycles=${counts.program_cycles} levels=${counts.levels}`;
}

async function deleteIfMatched(
  operation: () => Promise<unknown>,
): Promise<boolean> {
  try {
    await operation();
    return true;
  } catch {
    return false;
  }
}

async function cleanupMarkedFixtures(label: "STARTUP" | "FINAL" | "FAKE_MARKER"): Promise<boolean> {
  if (!guardedDb) return false;

  let parents: MarkerParents;
  let before: Counts;
  try {
    parents = await findMarkedParents(guardedDb);
    before = await countMarkedRows(guardedDb, parents);
  } catch {
    process.stdout.write(`ECHEC ${label}_COUNT_BEFORE\n`);
    return false;
  }
  process.stdout.write(`${label}_ZZ_BEFORE ${formatCounts(before)}\n`);

  let deletionsSucceeded = true;
  const levelFilter = parentIdFilter(schema.levels.programId, schema.levels.cycleId, parents);
  if (levelFilter) {
    deletionsSucceeded = await deleteIfMatched(
      () => guardedDb!.delete(schema.levels).where(levelFilter),
    ) && deletionsSucceeded;
  }

  const programCycleFilter = parentIdFilter(
    schema.programCycles.programId,
    schema.programCycles.cycleId,
    parents,
  );
  if (programCycleFilter) {
    deletionsSucceeded = await deleteIfMatched(
      () => guardedDb!.delete(schema.programCycles).where(programCycleFilter),
    ) && deletionsSucceeded;
  }

  deletionsSucceeded = await deleteIfMatched(
    () => guardedDb!.delete(schema.cycles)
      .where(sql`${schema.cycles.name} ~ ${SQL_MARKER_PATTERN}`),
  ) && deletionsSucceeded;
  deletionsSucceeded = await deleteIfMatched(
    () => guardedDb!.delete(schema.programs)
      .where(sql`${schema.programs.slug} ~ ${SQL_MARKER_PATTERN}`),
  ) && deletionsSucceeded;
  deletionsSucceeded = await deleteIfMatched(
    () => guardedDb!.delete(schema.universities)
      .where(sql`${schema.universities.slug} ~ ${SQL_MARKER_PATTERN}`),
  ) && deletionsSucceeded;

  let after: Counts;
  try {
    after = await countMarkedRows(guardedDb, parents);
  } catch {
    process.stdout.write(`ECHEC ${label}_COUNT_AFTER\n`);
    return false;
  }
  process.stdout.write(`${label}_ZZ_AFTER ${formatCounts(after)}\n`);
  const noResidues = totalRows(after) === 0;
  process.stdout.write(`${label}_ZZ_FINAL_TOTAL=${totalRows(after)}\n`);
  if (!deletionsSucceeded || !noResidues) {
    process.stdout.write(`ECHEC ${label}_CLEANUP\n`);
    return false;
  }
  return true;
}

async function testFalseMarkerCleanup(db: DbContext["db"]): Promise<boolean> {
  if (FAKE_MARKERS.some((marker) => JS_MARKER_PATTERN.test(marker))) {
    process.stdout.write("ECHEC FAKE_MARKERS_MATCH_VALID_PATTERN\n");
    return false;
  }
  process.stdout.write("OK fake_markers_do_not_match_valid_pattern\n");

  let insertedIds: string[] = [];
  let passed = false;
  try {
    const staleRows = await db.select({ id: schema.universities.id })
      .from(schema.universities)
      .where(inArray(schema.universities.slug, [...FAKE_MARKERS]));
    process.stdout.write(`FAKE_MARKER_STALE_BEFORE=${staleRows.length}\n`);
    for (const row of staleRows) {
      await db.delete(schema.universities).where(eq(schema.universities.id, row.id));
    }
    const staleAfter = await db.select({ id: schema.universities.id })
      .from(schema.universities)
      .where(inArray(schema.universities.slug, [...FAKE_MARKERS]));
    process.stdout.write(`FAKE_MARKER_STALE_AFTER=${staleAfter.length}\n`);
    if (staleAfter.length > 0) return false;

    const inserted = await db.insert(schema.universities).values(
      FAKE_MARKERS.map((marker) => ({ name: marker, slug: marker })),
    ).returning({ id: schema.universities.id, slug: schema.universities.slug });
    insertedIds = inserted.map(({ id }) => id);
    process.stdout.write(`FAKE_MARKERS_INSERTED=${inserted.length}\n`);
    if (inserted.length !== FAKE_MARKERS.length) return false;

    const cleanupOk = await cleanupMarkedFixtures("FAKE_MARKER");
    const surviving = await db.select({ id: schema.universities.id, slug: schema.universities.slug })
      .from(schema.universities)
      .where(inArray(schema.universities.id, insertedIds));
    const survivingSlugs = new Set(surviving.map(({ slug }) => slug));
    const suffixSurvived = survivingSlugs.has(FAKE_MARKERS[0]);
    const shortSurvived = survivingSlugs.has(FAKE_MARKERS[1]);
    const digitSurvived = survivingSlugs.has(FAKE_MARKERS[2]);
    process.stdout.write(
      `FAKE_MARKERS_SURVIVE suffix=${Number(suffixSurvived)} short=${Number(shortSurvived)} digit=${Number(digitSurvived)}\n`,
    );
    passed = cleanupOk && suffixSurvived && shortSurvived && digitSurvived;
  } catch (error) {
    reportDatabaseFailure("fake_marker_cleanup", error);
  } finally {
    for (const id of insertedIds) {
      try {
        await db.delete(schema.universities).where(eq(schema.universities.id, id));
      } catch {
        passed = false;
      }
    }
    if (insertedIds.length > 0) {
      try {
        const remaining = await db.select({ id: schema.universities.id })
          .from(schema.universities)
          .where(inArray(schema.universities.id, insertedIds));
        process.stdout.write(`FAKE_MARKERS_AFTER_DELETE=${remaining.length}\n`);
        if (remaining.length > 0) passed = false;
      } catch {
        process.stdout.write("ECHEC FAKE_MARKERS_COUNT_AFTER_DELETE\n");
        passed = false;
      }
    }
  }
  process.stdout.write(`${passed ? "OK" : "ECHEC"} fake_marker_survival_and_id_cleanup\n`);
  return passed;
}

function reportDatabaseFailure(name: string, error: unknown): void {
  const dbError = error as { code?: unknown; constraint?: unknown };
  const code = typeof dbError?.code === "string" ? dbError.code : "inconnu";
  const constraint = typeof dbError?.constraint === "string"
    ? dbError.constraint
    : "inconnue";
  process.stdout.write(`ECHEC ${name} SQLSTATE=${code} contrainte=${constraint}\n`);
  failed = true;
}

async function runCase(name: string, check: () => Promise<boolean>): Promise<void> {
  if (interrupted) return;
  try {
    const passed = await check();
    process.stdout.write(`${passed ? "OK" : "ECHEC"} ${name}\n`);
    if (!passed) failed = true;
  } catch (error) {
    reportDatabaseFailure(name, error);
  }
}

async function createFixtures(db: DbContext["db"]) {
  const markers = createRunMarkers();
  const [universityA] = await db.insert(schema.universities).values({
    name: markers.universityA,
    slug: markers.universityA,
  }).returning({ id: schema.universities.id });
  const [universityB] = await db.insert(schema.universities).values({
    name: markers.universityB,
    slug: markers.universityB,
  }).returning({ id: schema.universities.id });
  if (!universityA || !universityB) throw new Error("Fixture creation failed");

  const [programA] = await db.insert(schema.programs).values({
    universityId: universityA.id,
    name: markers.universityA,
    slug: markers.universityA,
  }).returning({ id: schema.programs.id });
  const [programB] = await db.insert(schema.programs).values({
    universityId: universityB.id,
    name: markers.universityB,
    slug: markers.universityB,
  }).returning({ id: schema.programs.id });
  if (!programA || !programB) throw new Error("Fixture creation failed");

  const [cycleA] = await db.insert(schema.cycles).values({
    universityId: universityA.id,
    name: markers.universityA,
    shortCode: "ZA",
    yearsCount: 3,
    order: 1,
  }).returning({ id: schema.cycles.id });
  const [cycleB] = await db.insert(schema.cycles).values({
    universityId: universityB.id,
    name: markers.universityB,
    shortCode: "ZB",
    yearsCount: 3,
    order: 1,
  }).returning({ id: schema.cycles.id });
  if (!cycleA || !cycleB) throw new Error("Fixture creation failed");

  await db.insert(schema.programCycles).values([
    { universityId: universityA.id, programId: programA.id, cycleId: cycleA.id, yearsCount: 3 },
    { universityId: universityB.id, programId: programB.id, cycleId: cycleB.id, yearsCount: 3 },
  ]);
  const [levelA] = await db.insert(schema.levels).values({
    universityId: universityA.id,
    programId: programA.id,
    cycleId: cycleA.id,
    name: "ZA1",
    slug: "za1",
    yearNumber: 1,
  }).returning({ id: schema.levels.id });
  const [levelB] = await db.insert(schema.levels).values({
    universityId: universityB.id,
    programId: programB.id,
    cycleId: cycleB.id,
    name: "ZB1",
    slug: "zb1",
    yearNumber: 1,
  }).returning({ id: schema.levels.id });
  if (!levelA || !levelB) throw new Error("Fixture creation failed");

  return {
    universityA: universityA.id,
    universityB: universityB.id,
    programA: programA.id,
    programB: programB.id,
    cycleA: cycleA.id,
    cycleB: cycleB.id,
    levelA: levelA.id,
    levelB: levelB.id,
  };
}

async function runTests(): Promise<void> {
  if (Object.hasOwn(process.env, "DATABASE_URL")) {
    process.stdout.write("ECHEC DATABASE_URL_PREEXISTANTE\n");
    failed = true;
    return;
  }

  try {
    const guarded = openGuardedDatabase();
    guardedDb = guarded.db;
    guardPool = guarded.pool;
  } catch {
    process.stdout.write("ECHEC GARDE_BASE\n");
    failed = true;
    return;
  }

  if (!await testFalseMarkerCleanup(guardedDb)) {
    failed = true;
    return;
  }

  if (!await cleanupMarkedFixtures("STARTUP")) {
    failed = true;
    return;
  }
  if (interrupted) return;

  let fixtures: Awaited<ReturnType<typeof createFixtures>>;
  try {
    fixtures = await createFixtures(guardedDb);
  } catch (error) {
    reportDatabaseFailure("fixtures_setup", error);
    return;
  }

  const {
    updateCycleYearsCount,
    updateCycleShortCode,
    updateLevelYearNumber,
    updateProgramStatus,
  } = await import("../src/structure");

  await runCase("cycle_B_refused_for_university_A", async () => {
    const result = await updateCycleYearsCount(
      fixtures.universityA,
      fixtures.cycleB,
      2,
      guardedDb,
    );
    return !result.ok && result.reason === "cycle_not_found";
  });
  await runCase("level_B_refused_for_university_A", async () => {
    const result = await updateLevelYearNumber(
      fixtures.universityA,
      fixtures.levelB,
      2,
      guardedDb,
    );
    return !result.ok && result.reason === "level_not_found";
  });
  await runCase("cycle_short_code_B_refused_for_university_A", async () => {
    const result = await updateCycleShortCode(
      fixtures.universityA,
      fixtures.cycleB,
      "ZX",
      guardedDb,
    );
    return !result.ok && result.reason === "cycle_not_found";
  });
  await runCase("program_B_refused_for_university_A", async () => {
    const result = await updateProgramStatus(
      fixtures.universityA,
      fixtures.programB,
      "published",
      guardedDb,
    );
    return !result.ok && result.reason === "program_not_found";
  });
  await runCase("unknown_program_refused", async () => {
    const result = await updateProgramStatus(
      fixtures.universityA,
      randomUUID(),
      "published",
      guardedDb,
    );
    return !result.ok && result.reason === "program_not_found";
  });
  await runCase("program_status_update_allowed", async () => {
    const result = await updateProgramStatus(
      fixtures.universityA,
      fixtures.programA,
      "published",
      guardedDb,
    );
    if (!result.ok) return false;
    const [program] = await guardedDb!
      .select({ status: schema.programs.status })
      .from(schema.programs)
      .where(sql`${schema.programs.universityId} = ${fixtures.universityA} AND ${schema.programs.id} = ${fixtures.programA}`)
      .limit(1);
    return program?.status === "published";
  });

  if (process.argv.includes("--wait-for-sigint") && !interrupted) {
    process.stdout.write("READY_FOR_SIGINT\n");
    await new Promise<void>((resolve) => {
      const keepAlive = setInterval(() => undefined, 1_000);
      resolveSignalWait = () => {
        clearInterval(keepAlive);
        resolve();
      };
      if (interrupted) resolveSignalWait();
    });
  }
}

async function finish(): Promise<void> {
  if (finishPromise) return finishPromise;
  finishPromise = (async () => {
    let cleanupOk = false;
    let timeout: NodeJS.Timeout | undefined;
    if (guardedDb) {
      timeout = setTimeout(() => {
        process.stdout.write("ECHEC CLEANUP_TIMEOUT : résidus possibles, relancer le script\n");
        process.exit(1);
      }, CLEANUP_TIMEOUT_MS);
      cleanupOk = await cleanupMarkedFixtures("FINAL");
      clearTimeout(timeout);
    }

    try {
      await guardPool?.end();
    } catch {
      process.stdout.write("ECHEC POOL_CLOSE\n");
      cleanupOk = false;
    }

    if (interrupted) {
      process.stdout.write(`${cleanupOk ? "OK" : "ECHEC"} SIGINT_CLEANUP\n`);
      process.exitCode = cleanupOk ? 130 : 1;
    } else {
      process.exitCode = failed || !cleanupOk ? 1 : 0;
    }
  })();
  return finishPromise;
}

const work = Promise.resolve().then(runTests).catch(() => {
  process.stdout.write("ECHEC TEST_RUN\n");
  failed = true;
});

process.on("SIGINT", () => {
  if (sigintHandled) return;
  sigintHandled = true;
  interrupted = true;
  resolveSignalWait?.();
  void work.then(finish);
});

void work.then(() => {
  if (!sigintHandled) return finish();
});
