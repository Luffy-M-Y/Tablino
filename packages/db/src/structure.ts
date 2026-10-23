import { and, eq, gt, inArray, max, ne } from "drizzle-orm";
import type { db as sharedDb } from "./client";
import * as schema from "./schema";
import {
  buildLevelName,
  buildLevelSlug,
  buildSubjectSlug,
  isCycleValid,
  isShortCodeValid,
  isProgramStatusValid,
  isYearNumberInRange,
  normalizeShortCode,
  normalizeCycleName,
} from "./structure-validation";

type StructureDatabase = typeof sharedDb;

const PROGRAM_NAME_MAX_LENGTH = 255;
const CYCLE_NAME_MAX_LENGTH = 100;
const SUBJECT_NAME_MAX_LENGTH = 255;

async function resolveDatabase(database?: StructureDatabase): Promise<StructureDatabase> {
  return database ?? (await import("./client")).db;
}

function normalizeName(name: string): string {
  return typeof name === "string" ? name.trim() : "";
}

function isNameValid(name: string, maxLength: number): boolean {
  const length = [...name].length;
  return length >= 1 && length <= maxLength;
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

export type RenameProgramResult =
  | { ok: true }
  | { ok: false; reason: "invalid_name" | "program_not_found" };

export type RenameCycleResult =
  | { ok: true }
  | { ok: false; reason: "invalid_name" | "cycle_not_found" };

export type RenameSubjectResult =
  | { ok: true }
  | { ok: false; reason: "invalid_name" | "not_found" };

export type CreateSubjectResult =
  | { ok: true }
  | {
      ok: false;
      reason: "level_not_found" | "academic_year_not_found" | "invalid_academic_year" | "invalid_name" | "subject_exists";
    };

export type CreateSubjectAcademicYear = { id?: string | null; label?: string | null };
export type DeleteSubjectResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "has_dependents" };

export type DeleteProgramCycleResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "has_levels" };

export type AddProgramCycleResult =
  | { ok: true }
  | {
      ok: false;
      reason: "program_not_found" | "cycle_not_found" | "years_out_of_range" | "already_linked";
    };

export type UpdateProgramCycleYearsCountResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "years_out_of_range" }
  | {
      ok: false;
      reason: "blocking_levels";
      blockingLevels: { name: string; yearNumber: number }[];
    };

export type DeleteCycleResult =
  | { ok: true }
  | { ok: false; reason: "cycle_not_found" | "has_dependents" };

export type DeleteProgramResult =
  | { ok: true }
  | { ok: false; reason: "program_not_found" | "has_dependents" };

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

export async function renameProgram(
  universityId: string,
  programId: string,
  name: string,
  database?: StructureDatabase,
): Promise<RenameProgramResult> {
  return (await resolveDatabase(database)).transaction(async (tx) => {
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

    const normalizedName = normalizeName(name);
    if (!isNameValid(normalizedName, PROGRAM_NAME_MAX_LENGTH)) {
      return { ok: false, reason: "invalid_name" };
    }

    await tx
      .update(schema.programs)
      .set({ name: normalizedName })
      .where(and(
        eq(schema.programs.universityId, universityId),
        eq(schema.programs.id, programId),
      ));

    return { ok: true };
  });
}

export async function renameCycle(
  universityId: string,
  cycleId: string,
  name: string,
  database?: StructureDatabase,
): Promise<RenameCycleResult> {
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

    if (!cycle) return { ok: false, reason: "cycle_not_found" };

    const normalizedName = normalizeName(name);
    if (!isNameValid(normalizedName, CYCLE_NAME_MAX_LENGTH)) {
      return { ok: false, reason: "invalid_name" };
    }

    await tx
      .update(schema.cycles)
      .set({ name: normalizedName })
      .where(and(
        eq(schema.cycles.universityId, universityId),
        eq(schema.cycles.id, cycleId),
      ));

    return { ok: true };
  });
}

export async function renameSubject(
  universityId: string,
  subjectId: string,
  name: string,
  database?: StructureDatabase,
): Promise<RenameSubjectResult> {
  return (await resolveDatabase(database)).transaction(async (tx) => {
    const [subject] = await tx
      .select({ id: schema.subjects.id })
      .from(schema.subjects)
      .where(and(
        eq(schema.subjects.universityId, universityId),
        eq(schema.subjects.id, subjectId),
      ))
      .for("update")
      .limit(1);

    if (!subject) return { ok: false, reason: "not_found" };

    const normalizedName = normalizeName(name);
    if (!isNameValid(normalizedName, SUBJECT_NAME_MAX_LENGTH)) {
      return { ok: false, reason: "invalid_name" };
    }

    await tx
      .update(schema.subjects)
      .set({ name: normalizedName })
      .where(and(
        eq(schema.subjects.universityId, universityId),
        eq(schema.subjects.id, subjectId),
      ));

    return { ok: true };
  });
}

export async function createSubject(
  universityId: string,
  levelId: string,
  academicYear: CreateSubjectAcademicYear,
  name: string,
  database?: StructureDatabase,
): Promise<CreateSubjectResult> {
  return (await resolveDatabase(database)).transaction(async (tx) => {
    const levels = await tx
      .select({ id: schema.levels.id })
      .from(schema.levels)
      .where(and(
        eq(schema.levels.universityId, universityId),
        eq(schema.levels.id, levelId),
      ))
      .for("update")
      .limit(1);

    if (!(levels.length > 0)) return { ok: false, reason: "level_not_found" };

    const normalizedName = normalizeName(name);
    if (!isNameValid(normalizedName, SUBJECT_NAME_MAX_LENGTH)) {
      return { ok: false, reason: "invalid_name" };
    }

    const slug = buildSubjectSlug(normalizedName);
    if (!slug) return { ok: false, reason: "invalid_name" };

    let resolvedAcademicYearId: string | null = null;
    const academicYearLabel = normalizeName(academicYear.label ?? "");
    if (academicYearLabel) {
      const academicYearMatch = /^(\d{4})-(\d{4})$/.exec(academicYearLabel);
      if (!academicYearMatch || Number(academicYearMatch[2]) !== Number(academicYearMatch[1]) + 1) {
        return { ok: false, reason: "invalid_academic_year" };
      }

      let academicYears = await tx
        .select({ id: schema.academicYears.id })
        .from(schema.academicYears)
        .where(and(
          eq(schema.academicYears.universityId, universityId),
          eq(schema.academicYears.label, academicYearLabel),
        ))
        .limit(1);

      if (!(academicYears.length > 0)) {
        await tx
          .insert(schema.academicYears)
          .values({
            universityId,
            label: academicYearLabel,
            startsAt: null,
            endsAt: null,
          })
          .onConflictDoNothing({
            target: [schema.academicYears.universityId, schema.academicYears.label],
          });

        academicYears = await tx
          .select({ id: schema.academicYears.id })
          .from(schema.academicYears)
          .where(and(
            eq(schema.academicYears.universityId, universityId),
            eq(schema.academicYears.label, academicYearLabel),
          ))
          .limit(1);
      }

      if (!(academicYears.length > 0)) {
        return { ok: false, reason: "academic_year_not_found" };
      }
      const academicYearRow = academicYears[0];
      if (!academicYearRow) {
        return { ok: false, reason: "academic_year_not_found" };
      }
      resolvedAcademicYearId = academicYearRow.id;
    } else if (academicYear.id) {
      const academicYears = await tx
        .select({ id: schema.academicYears.id })
        .from(schema.academicYears)
        .where(and(
          eq(schema.academicYears.universityId, universityId),
          eq(schema.academicYears.id, academicYear.id),
        ))
        .limit(1);

      if (!(academicYears.length > 0)) {
        return { ok: false, reason: "academic_year_not_found" };
      }
      const academicYearRow = academicYears[0];
      if (!academicYearRow) {
        return { ok: false, reason: "academic_year_not_found" };
      }
      resolvedAcademicYearId = academicYearRow.id;
    } else {
      return { ok: false, reason: "academic_year_not_found" };
    }

    if (!resolvedAcademicYearId) {
      return { ok: false, reason: "academic_year_not_found" };
    }

    const existingSubjects = await tx
      .select({ id: schema.subjects.id })
      .from(schema.subjects)
      .where(and(
        eq(schema.subjects.universityId, universityId),
        eq(schema.subjects.levelId, levelId),
        eq(schema.subjects.academicYearId, resolvedAcademicYearId),
        eq(schema.subjects.slug, slug),
      ))
      .limit(1);

    if (existingSubjects.length > 0) {
      return { ok: false, reason: "subject_exists" };
    }

    await tx
      .insert(schema.subjects)
      .values({
        universityId,
        levelId,
        academicYearId: resolvedAcademicYearId,
        name: normalizedName,
        slug,
      });

    return { ok: true };
  });
}

export async function deleteSubject(
  universityId: string,
  subjectId: string,
  database?: StructureDatabase,
): Promise<DeleteSubjectResult> {
  return (await resolveDatabase(database)).transaction(async (tx) => {
    const [subject] = await tx
      .select({ id: schema.subjects.id })
      .from(schema.subjects)
      .where(and(
        eq(schema.subjects.universityId, universityId),
        eq(schema.subjects.id, subjectId),
      ))
      .for("update")
      .limit(1);

    if (!subject) return { ok: false, reason: "not_found" };

    const [resources, assignments] = await Promise.all([
      tx.select({ id: schema.resources.id })
        .from(schema.resources)
        .where(and(
          eq(schema.resources.universityId, universityId),
          eq(schema.resources.subjectId, subjectId),
        ))
        .limit(1),
      tx.select({ id: schema.assignments.id })
        .from(schema.assignments)
        .where(and(
          eq(schema.assignments.universityId, universityId),
          eq(schema.assignments.subjectId, subjectId),
        ))
        .limit(1),
    ]);

    if (resources.length > 0 || assignments.length > 0) {
      return { ok: false, reason: "has_dependents" };
    }

    await tx
      .delete(schema.subjects)
      .where(and(
        eq(schema.subjects.universityId, universityId),
        eq(schema.subjects.id, subjectId),
      ));

    return { ok: true };
  });
}

export async function deleteProgramCycle(
  universityId: string,
  programId: string,
  cycleId: string,
  database?: StructureDatabase,
): Promise<DeleteProgramCycleResult> {
  return (await resolveDatabase(database)).transaction(async (tx) => {
    const [programCycle] = await tx
      .select({ programId: schema.programCycles.programId })
      .from(schema.programCycles)
      .where(and(
        eq(schema.programCycles.universityId, universityId),
        eq(schema.programCycles.programId, programId),
        eq(schema.programCycles.cycleId, cycleId),
      ))
      .for("update")
      .limit(1);

    if (!programCycle) return { ok: false, reason: "not_found" };

    const [level] = await tx
      .select({ id: schema.levels.id })
      .from(schema.levels)
      .where(and(
        eq(schema.levels.universityId, universityId),
        eq(schema.levels.programId, programId),
        eq(schema.levels.cycleId, cycleId),
      ))
      .limit(1);

    if (level) return { ok: false, reason: "has_levels" };

    await tx
      .delete(schema.programCycles)
      .where(and(
        eq(schema.programCycles.universityId, universityId),
        eq(schema.programCycles.programId, programId),
        eq(schema.programCycles.cycleId, cycleId),
      ));

    return { ok: true };
  });
}

export async function addProgramCycle(
  universityId: string,
  programId: string,
  cycleId: string,
  yearsCount: number,
  database?: StructureDatabase,
): Promise<AddProgramCycleResult> {
  return (await resolveDatabase(database)).transaction(async (tx) => {
    const programs = await tx
      .select({ id: schema.programs.id })
      .from(schema.programs)
      .where(and(
        eq(schema.programs.universityId, universityId),
        eq(schema.programs.id, programId),
      ))
      .for("update")
      .limit(1);

    if (!(programs.length > 0)) return { ok: false, reason: "program_not_found" };

    const cycles = await tx
      .select({ id: schema.cycles.id, shortCode: schema.cycles.shortCode })
      .from(schema.cycles)
      .where(and(
        eq(schema.cycles.universityId, universityId),
        eq(schema.cycles.id, cycleId),
      ))
      .for("update")
      .limit(1);

    if (!(cycles.length > 0)) return { ok: false, reason: "cycle_not_found" };
    const cycle = cycles[0];
    if (!cycle) return { ok: false, reason: "cycle_not_found" };
    if (!isYearNumberInRange(yearsCount, 10)) {
      return { ok: false, reason: "years_out_of_range" };
    }

    const programCycles = await tx
      .select({ programId: schema.programCycles.programId })
      .from(schema.programCycles)
      .where(and(
        eq(schema.programCycles.universityId, universityId),
        eq(schema.programCycles.programId, programId),
        eq(schema.programCycles.cycleId, cycleId),
      ))
      .limit(1);

    if (programCycles.length > 0) return { ok: false, reason: "already_linked" };

    await tx
      .insert(schema.programCycles)
      .values({ universityId, programId, cycleId, yearsCount });

    await tx
      .insert(schema.levels)
      .values(Array.from({ length: yearsCount }, (_, index) => {
        const yearNumber = index + 1;
        return {
          universityId,
          programId,
          cycleId,
          name: buildLevelName(cycle.shortCode, yearNumber),
          slug: buildLevelSlug(cycle.shortCode, yearNumber),
          yearNumber,
        };
      }));

    return { ok: true };
  });
}

export async function updateProgramCycleYearsCount(
  universityId: string,
  programId: string,
  cycleId: string,
  newYearsCount: number,
  database?: StructureDatabase,
): Promise<UpdateProgramCycleYearsCountResult> {
  return (await resolveDatabase(database)).transaction(async (tx) => {
    const programCycles = await tx
      .select({ programId: schema.programCycles.programId })
      .from(schema.programCycles)
      .where(and(
        eq(schema.programCycles.universityId, universityId),
        eq(schema.programCycles.programId, programId),
        eq(schema.programCycles.cycleId, cycleId),
      ))
      .for("update")
      .limit(1);

    if (!(programCycles.length > 0)) return { ok: false, reason: "not_found" };
    if (!isYearNumberInRange(newYearsCount, 10)) {
      return { ok: false, reason: "years_out_of_range" };
    }

    const cycles = await tx
      .select({ shortCode: schema.cycles.shortCode })
      .from(schema.cycles)
      .where(and(
        eq(schema.cycles.universityId, universityId),
        eq(schema.cycles.id, cycleId),
      ))
      .for("update")
      .limit(1);

    if (!(cycles.length > 0)) return { ok: false, reason: "not_found" };
    const cycle = cycles[0];
    if (!cycle) return { ok: false, reason: "not_found" };

    const levels = await tx
      .select({
        id: schema.levels.id,
        name: schema.levels.name,
        yearNumber: schema.levels.yearNumber,
      })
      .from(schema.levels)
      .where(and(
        eq(schema.levels.universityId, universityId),
        eq(schema.levels.programId, programId),
        eq(schema.levels.cycleId, cycleId),
      ))
      .for("update");

    const removedLevels = levels.filter((level) => level.yearNumber > newYearsCount);
    let blockingLevels: { name: string; yearNumber: number }[] = [];

    if (removedLevels.length > 0) {
      const subjects = await tx
        .select({ levelId: schema.subjects.levelId })
        .from(schema.subjects)
        .where(and(
          eq(schema.subjects.universityId, universityId),
          inArray(schema.subjects.levelId, removedLevels.map((level) => level.id)),
        ));
      const levelIdsWithSubjects = new Set(subjects.map((subject) => subject.levelId));
      blockingLevels = removedLevels
        .filter((level) => levelIdsWithSubjects.has(level.id))
        .map(({ name, yearNumber }) => ({ name, yearNumber }));

      if (blockingLevels.length > 0) {
        return { ok: false, reason: "blocking_levels", blockingLevels };
      }

      await tx
        .delete(schema.levels)
        .where(and(
          eq(schema.levels.universityId, universityId),
          eq(schema.levels.programId, programId),
          eq(schema.levels.cycleId, cycleId),
          gt(schema.levels.yearNumber, newYearsCount),
        ));
    }

    const existingYearNumbers = new Set(
      levels
        .filter((level) => level.yearNumber <= newYearsCount)
        .map((level) => level.yearNumber),
    );
    const missingLevels = Array.from({ length: newYearsCount }, (_, index) => index + 1)
      .filter((yearNumber) => !existingYearNumbers.has(yearNumber))
      .map((yearNumber) => ({
        universityId,
        programId,
        cycleId,
        name: buildLevelName(cycle.shortCode, yearNumber),
        slug: buildLevelSlug(cycle.shortCode, yearNumber),
        yearNumber,
      }));

    if (missingLevels.length > 0) {
      await tx.insert(schema.levels).values(missingLevels);
    }

    await tx
      .update(schema.programCycles)
      .set({ yearsCount: newYearsCount })
      .where(and(
        eq(schema.programCycles.universityId, universityId),
        eq(schema.programCycles.programId, programId),
        eq(schema.programCycles.cycleId, cycleId),
      ));

    return { ok: true };
  });
}

export async function deleteCycle(
  universityId: string,
  cycleId: string,
  database?: StructureDatabase,
): Promise<DeleteCycleResult> {
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

    if (!cycle) return { ok: false, reason: "cycle_not_found" };

    const [programCycles, levels] = await Promise.all([
      tx.select({ programId: schema.programCycles.programId })
        .from(schema.programCycles)
        .where(and(
          eq(schema.programCycles.universityId, universityId),
          eq(schema.programCycles.cycleId, cycleId),
        ))
        .limit(1),
      tx.select({ id: schema.levels.id })
        .from(schema.levels)
        .where(and(
          eq(schema.levels.universityId, universityId),
          eq(schema.levels.cycleId, cycleId),
        ))
        .limit(1),
    ]);

    if (programCycles.length > 0 || levels.length > 0) {
      return { ok: false, reason: "has_dependents" };
    }

    await tx
      .delete(schema.cycles)
      .where(and(
        eq(schema.cycles.universityId, universityId),
        eq(schema.cycles.id, cycleId),
      ));

    return { ok: true };
  });
}

export async function deleteProgram(
  universityId: string,
  programId: string,
  database?: StructureDatabase,
): Promise<DeleteProgramResult> {
  return (await resolveDatabase(database)).transaction(async (tx) => {
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

    const [programCycles, levels] = await Promise.all([
      tx.select({ cycleId: schema.programCycles.cycleId })
        .from(schema.programCycles)
        .where(and(
          eq(schema.programCycles.universityId, universityId),
          eq(schema.programCycles.programId, programId),
        ))
        .limit(1),
      tx.select({ id: schema.levels.id })
        .from(schema.levels)
        .where(and(
          eq(schema.levels.universityId, universityId),
          eq(schema.levels.programId, programId),
        ))
        .limit(1),
    ]);

    if (programCycles.length > 0 || levels.length > 0) {
      return { ok: false, reason: "has_dependents" };
    }

    await tx
      .delete(schema.programs)
      .where(and(
        eq(schema.programs.universityId, universityId),
        eq(schema.programs.id, programId),
      ));

    return { ok: true };
  });
}
