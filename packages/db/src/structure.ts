import { and, eq, gt, max, ne } from "drizzle-orm";
import type { db as sharedDb } from "./client";
import * as schema from "./schema";
import {
  buildLevelName,
  buildLevelSlug,
  isCycleValid,
  isShortCodeValid,
  isProgramStatusValid,
  isYearNumberInRange,
  normalizeShortCode,
  normalizeCycleName,
} from "./structure-validation";

type StructureDatabase = typeof sharedDb;

async function resolveDatabase(database?: StructureDatabase): Promise<StructureDatabase> {
  return database ?? (await import("./client")).db;
}

export type UpdateCycleYearsCountResult =
  | { ok: true }
  | {
      ok: false;
      reason: "cycle_not_found" | "out_of_range" | "blocking_levels";
      blockingLevels: { name: string; yearNumber: number }[];
    };

/** @deprecated Use UpdateCycleYearsCountResult. */
export type CanReduceYearsCountResult = UpdateCycleYearsCountResult;

export type UpdateLevelYearNumberResult =
  | { ok: true }
  | {
      ok: false;
      reason: "cycle_not_found" | "level_not_found" | "out_of_range" | "year_taken" | "slug_taken";
    };

export type UpdateCycleShortCodeResult =
  | { ok: true }
  | {
      ok: false;
      reason: "cycle_not_found" | "invalid_short_code" | "short_code_taken" | "has_levels";
    };

export type UpdateProgramStatusResult =
  | { ok: true }
  | { ok: false; reason: "program_not_found" | "invalid_status" };

export type CreateCycleResult =
  | { ok: true; cycleId: string }
  | { ok: false; reason: "invalid_cycle" | "duplicate_short_code" | "university_not_found" };

function isUniqueConstraintViolation(error: unknown, constraint: string): boolean {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as { code?: unknown; constraint?: unknown; cause?: unknown };
  if (candidate.code === "23505" && candidate.constraint === constraint) return true;
  return candidate.cause !== undefined && isUniqueConstraintViolation(candidate.cause, constraint);
}

export async function createCycle(
  universityId: string,
  name: string,
  shortCode: string,
  database?: StructureDatabase,
): Promise<CreateCycleResult> {
  const normalizedName = normalizeCycleName(name);
  const normalizedShortCode = normalizeShortCode(shortCode);
  if (!isCycleValid(normalizedName, normalizedShortCode)) {
    return { ok: false, reason: "invalid_cycle" };
  }

  try {
    return await (await resolveDatabase(database)).transaction(async (tx) => {
      const [university] = await tx
        .select({ id: schema.universities.id })
        .from(schema.universities)
        .where(eq(schema.universities.id, universityId))
        .for("update")
        .limit(1);

      if (!university) return { ok: false, reason: "university_not_found" };

      const [lastCycle] = await tx
        .select({ order: max(schema.cycles.order) })
        .from(schema.cycles)
        .where(eq(schema.cycles.universityId, universityId));
      const order = (lastCycle?.order ?? 0) + 1;

      const [cycle] = await tx
        .insert(schema.cycles)
        .values({
          universityId,
          name: normalizedName,
          shortCode: normalizedShortCode,
          yearsCount: null,
          order,
        })
        .returning({ id: schema.cycles.id });

      return cycle ? { ok: true, cycleId: cycle.id } : { ok: false, reason: "university_not_found" };
    });
  } catch (error) {
    if (isUniqueConstraintViolation(error, "cycles_university_short_code_uq")) {
      return { ok: false, reason: "duplicate_short_code" };
    }
    throw error;
  }
}

/** Updates the configured years count, refusing to orphan existing levels. */
export async function updateCycleYearsCount(
  universityId: string,
  cycleId: string,
  newYearsCount: number,
  database?: StructureDatabase,
): Promise<UpdateCycleYearsCountResult> {
  return (await resolveDatabase(database)).transaction(async (tx) => {
    const [cycle] = await tx
      .select({ id: schema.cycles.id })
      .from(schema.cycles)
      .where(and(
        eq(schema.cycles.universityId, universityId),
        eq(schema.cycles.id, cycleId),
      ))
      .for("update")
      .limit(1);

    if (!cycle) {
      return { ok: false, reason: "cycle_not_found", blockingLevels: [] };
    }

    if (!isYearNumberInRange(newYearsCount, 10)) {
      return { ok: false, reason: "out_of_range", blockingLevels: [] };
    }

    const blockingLevels = await tx
      .select({ name: schema.levels.name, yearNumber: schema.levels.yearNumber })
      .from(schema.levels)
      .where(and(
        eq(schema.levels.universityId, universityId),
        eq(schema.levels.cycleId, cycleId),
        gt(schema.levels.yearNumber, newYearsCount),
      ));

    if (blockingLevels.length > 0) {
      return { ok: false, reason: "blocking_levels", blockingLevels };
    }

    await tx
      .update(schema.cycles)
      .set({ yearsCount: newYearsCount })
      .where(and(
        eq(schema.cycles.universityId, universityId),
        eq(schema.cycles.id, cycleId),
      ));

    return { ok: true };
  });
}

/** @deprecated Use updateCycleYearsCount. This function also performs the update. */
export const canReduceYearsCount = updateCycleYearsCount;

/**
 * Updates a level's year, generated name and slug atomically while holding its cycle lock.
 */
export async function updateLevelYearNumber(
  universityId: string,
  levelId: string,
  newYearNumber: number,
  database?: StructureDatabase,
): Promise<UpdateLevelYearNumberResult> {
  try {
    return await (await resolveDatabase(database)).transaction(async (tx) => {
      const [initialLevel] = await tx
        .select({ cycleId: schema.levels.cycleId })
        .from(schema.levels)
        .where(and(
          eq(schema.levels.universityId, universityId),
          eq(schema.levels.id, levelId),
        ))
        .limit(1);

      if (!initialLevel) return { ok: false, reason: "level_not_found" };

      const [cycle] = await tx
        .select({
          id: schema.cycles.id,
          shortCode: schema.cycles.shortCode,
        })
        .from(schema.cycles)
        .where(and(
          eq(schema.cycles.universityId, universityId),
          eq(schema.cycles.id, initialLevel.cycleId),
        ))
        .for("update")
        .limit(1);

      if (!cycle) return { ok: false, reason: "cycle_not_found" };

      const [level] = await tx
        .select({
          id: schema.levels.id,
          cycleId: schema.levels.cycleId,
          programId: schema.levels.programId,
        })
        .from(schema.levels)
        .where(and(
          eq(schema.levels.universityId, universityId),
          eq(schema.levels.id, levelId),
        ))
        .limit(1);

      if (!level || level.cycleId !== cycle.id) {
        return { ok: false, reason: "level_not_found" };
      }

      const [programCycle] = await tx
        .select({ yearsCount: schema.programCycles.yearsCount })
        .from(schema.programCycles)
        .where(and(
          eq(schema.programCycles.universityId, universityId),
          eq(schema.programCycles.programId, level.programId),
          eq(schema.programCycles.cycleId, level.cycleId),
        ))
        .limit(1);

      if (!programCycle) return { ok: false, reason: "level_not_found" };

      if (!isYearNumberInRange(newYearNumber, programCycle.yearsCount)) {
        return { ok: false, reason: "out_of_range" };
      }

      const [yearCollision] = await tx
        .select({ id: schema.levels.id })
        .from(schema.levels)
        .where(and(
          eq(schema.levels.universityId, universityId),
          eq(schema.levels.programId, level.programId),
          eq(schema.levels.cycleId, cycle.id),
          eq(schema.levels.yearNumber, newYearNumber),
          ne(schema.levels.id, level.id),
        ))
        .limit(1);

      if (yearCollision) return { ok: false, reason: "year_taken" };

      const slug = buildLevelSlug(cycle.shortCode, newYearNumber);
      const [slugCollision] = await tx
        .select({ id: schema.levels.id })
        .from(schema.levels)
        .where(and(
          eq(schema.levels.universityId, universityId),
          eq(schema.levels.programId, level.programId),
          eq(schema.levels.slug, slug),
          ne(schema.levels.id, level.id),
        ))
        .limit(1);

      if (slugCollision) return { ok: false, reason: "slug_taken" };

      await tx
        .update(schema.levels)
        .set({
          yearNumber: newYearNumber,
          name: buildLevelName(cycle.shortCode, newYearNumber),
          slug,
        })
        .where(and(
          eq(schema.levels.universityId, universityId),
          eq(schema.levels.id, level.id),
        ));

      return { ok: true };
    });
  } catch (error) {
    if (isUniqueConstraintViolation(error, "levels_program_slug_uq")) {
      return { ok: false, reason: "slug_taken" };
    }
    if (isUniqueConstraintViolation(error, "levels_program_cycle_year_uq")) {
      return { ok: false, reason: "year_taken" };
    }
    throw error;
  }
}

/** Changes a cycle code only while no levels depend on its generated names/slugs. */
export async function updateCycleShortCode(
  universityId: string,
  cycleId: string,
  newShortCode: string,
  database?: StructureDatabase,
): Promise<UpdateCycleShortCodeResult> {
  const normalizedShortCode = normalizeShortCode(newShortCode);

  try {
    return await (await resolveDatabase(database)).transaction(async (tx) => {
      const [cycle] = await tx
        .select({ id: schema.cycles.id })
        .from(schema.cycles)
        .where(and(
          eq(schema.cycles.universityId, universityId),
          eq(schema.cycles.id, cycleId),
        ))
        .for("update")
        .limit(1);

      if (!cycle) return { ok: false, reason: "cycle_not_found" };
      if (!isShortCodeValid(normalizedShortCode)) {
        return { ok: false, reason: "invalid_short_code" };
      }

      const [level] = await tx
        .select({ id: schema.levels.id })
        .from(schema.levels)
        .where(and(
          eq(schema.levels.universityId, universityId),
          eq(schema.levels.cycleId, cycleId),
        ))
        .limit(1);

      if (level) return { ok: false, reason: "has_levels" };

      const [collision] = await tx
        .select({ id: schema.cycles.id })
        .from(schema.cycles)
        .where(and(
          eq(schema.cycles.universityId, universityId),
          eq(schema.cycles.shortCode, normalizedShortCode),
          ne(schema.cycles.id, cycleId),
        ))
        .limit(1);

      if (collision) return { ok: false, reason: "short_code_taken" };

      await tx
        .update(schema.cycles)
        .set({ shortCode: normalizedShortCode })
        .where(and(
          eq(schema.cycles.universityId, universityId),
          eq(schema.cycles.id, cycleId),
        ));

      return { ok: true };
    });
  } catch (error) {
    if (isUniqueConstraintViolation(error, "cycles_university_short_code_uq")) {
      return { ok: false, reason: "short_code_taken" };
    }
    throw error;
  }
}

/** Updates a program status after validating its tenant-scoped row. */
export async function updateProgramStatus(
  universityId: string,
  programId: string,
  newStatus: string,
  database?: StructureDatabase,
): Promise<UpdateProgramStatusResult> {
  return (await resolveDatabase(database)).transaction(async (tx) => {
    if (!isProgramStatusValid(newStatus)) {
      return { ok: false, reason: "invalid_status" };
    }

    const [program] = await tx
      .select({ id: schema.programs.id })
      .from(schema.programs)
      .where(and(
        eq(schema.programs.universityId, universityId),
        eq(schema.programs.id, programId),
      ))
      .for("update")
      .limit(1);

    if (!program) return { ok: false, reason: "program_not_found" };

    const [updated] = await tx
      .update(schema.programs)
      .set({ status: newStatus })
      .where(and(
        eq(schema.programs.universityId, universityId),
        eq(schema.programs.id, programId),
      ))
      .returning({ id: schema.programs.id });

    return updated ? { ok: true } : { ok: false, reason: "program_not_found" };
  });
}
