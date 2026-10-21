import { and, eq, gt, ne } from "drizzle-orm";
import { db } from "./client";
import * as schema from "./schema";
import {
  buildLevelName,
  buildLevelSlug,
  isShortCodeValid,
  isYearNumberInRange,
  normalizeShortCode,
} from "./structure-validation";

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

function isUniqueConstraintViolation(error: unknown, constraint: string): boolean {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as { code?: unknown; constraint?: unknown; cause?: unknown };
  if (candidate.code === "23505" && candidate.constraint === constraint) return true;
  return candidate.cause !== undefined && isUniqueConstraintViolation(candidate.cause, constraint);
}

/** Updates the configured years count, refusing to orphan existing levels. */
export async function updateCycleYearsCount(
  universityId: string,
  cycleId: string,
  newYearsCount: number,
): Promise<UpdateCycleYearsCountResult> {
  return db.transaction(async (tx) => {
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
): Promise<UpdateLevelYearNumberResult> {
  try {
    return await db.transaction(async (tx) => {
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
          yearsCount: schema.cycles.yearsCount,
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

      if (!isYearNumberInRange(newYearNumber, cycle.yearsCount)) {
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
): Promise<UpdateCycleShortCodeResult> {
  const normalizedShortCode = normalizeShortCode(newShortCode);

  try {
    return await db.transaction(async (tx) => {
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
