import "server-only";

import { and, asc, db, eq, schema } from "@tablino/db";
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
