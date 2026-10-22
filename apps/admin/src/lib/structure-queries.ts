import "server-only";

import { and, asc, count, db, eq, schema } from "@tablino/db";
import {
  AuthorizationDeniedError,
  requireRole,
  requireUniversityAccess,
  SessionRequiredError,
} from "@tablino/auth";
import { forbidden, redirect } from "next/navigation";
import { buildCycleSections } from "./structure-view.mjs";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function handleGuardError(error: unknown): never {
  if (error instanceof SessionRequiredError) redirect("/api/auth/signin");
  if (error instanceof AuthorizationDeniedError) forbidden();
  throw error;
}

async function requireSuperAdmin() {
  try {
    return await requireRole("admin", ["super_admin"]);
  } catch (error) {
    return handleGuardError(error);
  }
}

async function requireUniversityAdminAccess(universityId: string) {
  try {
    await requireRole("admin", ["super_admin", "university_admin"]);
    await requireUniversityAccess("admin", universityId);
    if (!UUID_PATTERN.test(universityId)) throw new AuthorizationDeniedError();
  } catch (error) {
    return handleGuardError(error);
  }
}

export async function getStructureUniversities() {
  await requireSuperAdmin();
  return db.select({
    id: schema.universities.id,
    name: schema.universities.name,
    slug: schema.universities.slug,
  }).from(schema.universities).orderBy(asc(schema.universities.name));
}

export async function getStructureOverview(universityId: string) {
  await requireUniversityAdminAccess(universityId);

  const [universityRows, programs, cycles, levels, academicYears, subjects] = await Promise.all([
    db.select({ id: schema.universities.id, name: schema.universities.name })
      .from(schema.universities)
      .where(eq(schema.universities.id, universityId))
      .limit(1),
    db.select({ id: schema.programs.id, name: schema.programs.name, status: schema.programs.status })
      .from(schema.programs)
      .where(eq(schema.programs.universityId, universityId))
      .orderBy(asc(schema.programs.name)),
    db.select({
      id: schema.cycles.id,
      name: schema.cycles.name,
      shortCode: schema.cycles.shortCode,
      yearsCount: schema.cycles.yearsCount,
      order: schema.cycles.order,
    }).from(schema.cycles)
      .where(eq(schema.cycles.universityId, universityId))
      .orderBy(asc(schema.cycles.order)),
    db.select({
      id: schema.levels.id,
      cycleId: schema.levels.cycleId,
      programId: schema.levels.programId,
      programName: schema.programs.name,
      name: schema.levels.name,
      slug: schema.levels.slug,
      yearNumber: schema.levels.yearNumber,
    }).from(schema.levels)
      .innerJoin(schema.programs, and(
        eq(schema.programs.id, schema.levels.programId),
        eq(schema.programs.universityId, universityId),
      ))
      .where(eq(schema.levels.universityId, universityId))
      .orderBy(asc(schema.levels.yearNumber)),
    db.select({
      id: schema.academicYears.id,
      label: schema.academicYears.label,
      startsAt: schema.academicYears.startsAt,
      endsAt: schema.academicYears.endsAt,
    }).from(schema.academicYears)
      .where(eq(schema.academicYears.universityId, universityId))
      .orderBy(asc(schema.academicYears.label)),
    db.select({
      id: schema.subjects.id,
      levelId: schema.subjects.levelId,
      name: schema.subjects.name,
      slug: schema.subjects.slug,
      academicYearLabel: schema.academicYears.label,
    }).from(schema.subjects)
      .innerJoin(schema.academicYears, and(
        eq(schema.academicYears.id, schema.subjects.academicYearId),
        eq(schema.academicYears.universityId, universityId),
      ))
      .where(eq(schema.subjects.universityId, universityId))
      .orderBy(asc(schema.subjects.name)),
  ]);

  const university = universityRows[0];
  if (!university) forbidden();

  return {
    university,
    programs,
    cycles: buildCycleSections(cycles, levels, subjects),
    academicYears,
  };
}

export async function getProgramsSummary(universityId: string) {
  await requireUniversityAdminAccess(universityId);

  const [programs, cycleCounts, subjectCounts] = await Promise.all([
    db.select({
      id: schema.programs.id,
      name: schema.programs.name,
      status: schema.programs.status,
    }).from(schema.programs)
      .where(eq(schema.programs.universityId, universityId))
      .orderBy(asc(schema.programs.name)),
    db.select({
      programId: schema.programCycles.programId,
      cyclesCount: count(),
    }).from(schema.programCycles)
      .where(eq(schema.programCycles.universityId, universityId))
      .groupBy(schema.programCycles.programId),
    db.select({
      programId: schema.levels.programId,
      subjectsCount: count(),
    }).from(schema.subjects)
      .innerJoin(schema.levels, and(
        eq(schema.levels.id, schema.subjects.levelId),
        eq(schema.levels.universityId, universityId),
      ))
      .where(eq(schema.subjects.universityId, universityId))
      .groupBy(schema.levels.programId),
  ]);

  const cyclesCountByProgramId = new Map(cycleCounts.map((row) => [row.programId, row.cyclesCount]));
  const subjectsCountByProgramId = new Map(subjectCounts.map((row) => [row.programId, row.subjectsCount]));

  return programs.map((program) => ({
    ...program,
    cyclesCount: cyclesCountByProgramId.get(program.id) ?? 0,
    subjectsCount: subjectsCountByProgramId.get(program.id) ?? 0,
  }));
}

export async function getProgramDetail(universityId: string, programId: string) {
  await requireUniversityAdminAccess(universityId);

  const [programRows, cycles, subjects] = await Promise.all([
    db.select({
      id: schema.programs.id,
      name: schema.programs.name,
      status: schema.programs.status,
    }).from(schema.programs)
      .where(and(
        eq(schema.programs.id, programId),
        eq(schema.programs.universityId, universityId),
      ))
      .limit(1),
    db.select({
      cycleId: schema.programCycles.cycleId,
      name: schema.cycles.name,
      shortCode: schema.cycles.shortCode,
      yearsCount: schema.programCycles.yearsCount,
      levelsCount: count(schema.levels.id),
      order: schema.cycles.order,
    }).from(schema.programCycles)
      .innerJoin(schema.cycles, and(
        eq(schema.cycles.id, schema.programCycles.cycleId),
        eq(schema.cycles.universityId, universityId),
      ))
      .leftJoin(schema.levels, and(
        eq(schema.levels.programId, schema.programCycles.programId),
        eq(schema.levels.cycleId, schema.programCycles.cycleId),
        eq(schema.levels.universityId, universityId),
      ))
      .where(and(
        eq(schema.programCycles.programId, programId),
        eq(schema.programCycles.universityId, universityId),
      ))
      .groupBy(
        schema.programCycles.cycleId,
        schema.cycles.name,
        schema.cycles.shortCode,
        schema.programCycles.yearsCount,
        schema.cycles.order,
      )
      .orderBy(asc(schema.cycles.order)),
    db.select({
      id: schema.subjects.id,
      name: schema.subjects.name,
      levelName: schema.levels.name,
    }).from(schema.subjects)
      .innerJoin(schema.levels, and(
        eq(schema.levels.id, schema.subjects.levelId),
        eq(schema.levels.programId, programId),
        eq(schema.levels.universityId, universityId),
      ))
      .where(eq(schema.subjects.universityId, universityId))
      .orderBy(asc(schema.levels.name), asc(schema.subjects.name)),
  ]);

  const program = programRows[0];
  if (!program) return null;

  return {
    ...program,
    cyclesCount: cycles.length,
    subjectsCount: subjects.length,
    cycles: cycles.map(({ order: _order, ...cycle }) => cycle),
    subjects,
  };
}
