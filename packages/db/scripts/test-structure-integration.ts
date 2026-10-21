import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import * as schema from "../src/schema";
import { openProvisioningDatabase } from "./_provisioning";

const CASES = [
  "year_taken",
  "out_of_range",
  "valid_change_and_rollback",
  "blocking_levels",
  "has_levels",
  "missing_university_cycle_years",
  "missing_university_level",
  "missing_university_cycle_short_code",
  "concurrent_year_updates",
] as const;

type DbContext = ReturnType<typeof openProvisioningDatabase>;

async function main() {
  const results = new Map<string, boolean>();
  let hasFailure = false;
  let guardedDb: DbContext["db"] | undefined;
  let guardPool: DbContext["pool"] | undefined;
  let mutationPool: (typeof import("../src/client"))["pool"] | undefined;
  let universityId: string | undefined;
  let programId: string | undefined;
  let cycleId: string | undefined;
  let firstLevelId: string | undefined;
  let secondLevelId: string | undefined;

  async function runCase(name: (typeof CASES)[number], run: () => Promise<boolean>) {
    try {
      const passed = await run();
      results.set(name, passed);
      console.log(`${passed ? "OK" : "ECHEC"} ${name}`);
      if (!passed) hasFailure = true;
    } catch {
      results.set(name, false);
      console.log(`ECHEC ${name}`);
      hasFailure = true;
    }
  }

  try {
    // This validates project reference and port before any database query.
    const guarded = openProvisioningDatabase();
    guardedDb = guarded.db;
    guardPool = guarded.pool;

    const [{ updateCycleYearsCount, updateLevelYearNumber, updateCycleShortCode }, client] =
      await Promise.all([
        import("../src/structure"),
        import("../src/client"),
      ]);
    mutationPool = client.pool;

    const [university] = await guardedDb
      .select({ id: schema.universities.id })
      .from(schema.universities)
      .where(eq(schema.universities.slug, "demo-universite"))
      .limit(1);
    if (!university) throw new Error("Demo fixture unavailable");
    universityId = university.id;

    const [program] = await guardedDb
      .select({ id: schema.programs.id })
      .from(schema.programs)
      .where(and(
        eq(schema.programs.universityId, universityId),
        eq(schema.programs.slug, "demo-informatique"),
      ))
      .limit(1);
    if (!program) throw new Error("Demo fixture unavailable");
    programId = program.id;

    const [cycle] = await guardedDb
      .insert(schema.cycles)
      .values({
        universityId,
        name: "Temporary integration cycle",
        shortCode: "ZZ",
        yearsCount: 4,
        order: 999,
      })
      .returning({ id: schema.cycles.id });
    if (!cycle) throw new Error("Temporary cycle creation failed");
    cycleId = cycle.id;

    await guardedDb.insert(schema.programCycles).values({
      programId,
      universityId,
      cycleId,
    });

    const [firstLevel] = await guardedDb
      .insert(schema.levels)
      .values({
        universityId,
        programId,
        cycleId,
        name: "ZZ1",
        slug: "zz1",
        yearNumber: 1,
      })
      .returning({ id: schema.levels.id });
    const [secondLevel] = await guardedDb
      .insert(schema.levels)
      .values({
        universityId,
        programId,
        cycleId,
        name: "ZZ2",
        slug: "zz2",
        yearNumber: 2,
      })
      .returning({ id: schema.levels.id });
    if (!firstLevel || !secondLevel) throw new Error("Temporary levels creation failed");
    firstLevelId = firstLevel.id;
    secondLevelId = secondLevel.id;

    await runCase("year_taken", async () => {
      const result = await updateLevelYearNumber(universityId!, firstLevelId!, 2);
      return !result.ok && result.reason === "year_taken";
    });

    await runCase("out_of_range", async () => {
      const result = await updateLevelYearNumber(universityId!, firstLevelId!, 5);
      return !result.ok && result.reason === "out_of_range";
    });

    await runCase("valid_change_and_rollback", async () => {
      const changed = await updateLevelYearNumber(universityId!, firstLevelId!, 3);
      if (!changed.ok) return false;
      const restored = await updateLevelYearNumber(universityId!, firstLevelId!, 1);
      return restored.ok;
    });

    await runCase("blocking_levels", async () => {
      const result = await updateCycleYearsCount(universityId!, cycleId!, 1);
      return !result.ok && result.reason === "blocking_levels";
    });

    await runCase("has_levels", async () => {
      const result = await updateCycleShortCode(universityId!, cycleId!, "XX");
      return !result.ok && result.reason === "has_levels";
    });

    const missingUniversityId = randomUUID();
    await runCase("missing_university_cycle_years", async () => {
      const result = await updateCycleYearsCount(missingUniversityId, randomUUID(), 1);
      return !result.ok && result.reason === "cycle_not_found";
    });

    await runCase("missing_university_level", async () => {
      const result = await updateLevelYearNumber(missingUniversityId, randomUUID(), 1);
      return !result.ok && result.reason === "level_not_found";
    });

    await runCase("missing_university_cycle_short_code", async () => {
      const result = await updateCycleShortCode(missingUniversityId, randomUUID(), "XX");
      return !result.ok && result.reason === "cycle_not_found";
    });

    await runCase("concurrent_year_updates", async () => {
      const [firstResult, secondResult] = await Promise.all([
        updateLevelYearNumber(universityId!, firstLevelId!, 4),
        updateLevelYearNumber(universityId!, secondLevelId!, 4),
      ]);
      const outcomes = [firstResult, secondResult];
      return outcomes.filter((result) => result.ok).length === 1
        && outcomes.filter((result) => !result.ok && result.reason === "year_taken").length === 1;
    });
  } catch {
    console.log("ECHEC setup_or_database_guard");
    hasFailure = true;
  } finally {
    for (const name of CASES) {
      if (!results.has(name)) {
        console.log(`ECHEC ${name} (non exécuté)`);
        hasFailure = true;
      }
    }

    if (guardedDb && universityId && cycleId) {
      const cleanupOperations = [
        () => guardedDb!.delete(schema.levels).where(and(
          eq(schema.levels.universityId, universityId!),
          eq(schema.levels.cycleId, cycleId!),
        )),
        ...(programId ? [() => guardedDb!.delete(schema.programCycles).where(and(
          eq(schema.programCycles.universityId, universityId!),
          eq(schema.programCycles.programId, programId!),
          eq(schema.programCycles.cycleId, cycleId!),
        ))] : []),
        () => guardedDb!.delete(schema.cycles).where(and(
          eq(schema.cycles.universityId, universityId!),
          eq(schema.cycles.id, cycleId!),
        )),
      ];

      for (const cleanup of cleanupOperations) {
        try {
          await cleanup();
        } catch {
          console.log("ECHEC cleanup");
          hasFailure = true;
        }
      }
    }

    try {
      await Promise.all([guardPool?.end(), mutationPool?.end()]);
    } catch {
      console.log("ECHEC pool_cleanup");
      hasFailure = true;
    }
  }

  if (hasFailure) process.exitCode = 1;
}

void main();
