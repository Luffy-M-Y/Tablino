import "server-only";

import { and, db, eq, schema } from "@tablino/db";
import {
  AuthorizationDeniedError,
  requireRole,
  requireUniversityAccess,
  SessionRequiredError,
} from "@tablino/auth";
import { forbidden, redirect } from "next/navigation";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function handleGuardError(error: unknown): never {
  if (error instanceof SessionRequiredError) redirect("/api/auth/signin");
  if (error instanceof AuthorizationDeniedError) forbidden();
  throw error;
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

export type ManagedFile = {
  id: string;
  kind: "resource" | "assignment";
  title: string;
  status: "draft" | "published";
  createdAt: Date;
  publishedAt: Date | null;
  programName: string;
  levelName: string;
  academicYearLabel: string;
  subjectName: string;
};

export async function getManagedResources(universityId: string): Promise<ManagedFile[]> {
  await requireUniversityAdminAccess(universityId);

  const resources = await db.select({
    id: schema.resources.id,
    title: schema.resources.title,
    status: schema.resources.status,
    createdAt: schema.resources.createdAt,
    publishedAt: schema.resources.publishedAt,
    programName: schema.programs.name,
    levelName: schema.levels.name,
    academicYearLabel: schema.academicYears.label,
    subjectName: schema.subjects.name,
  })
    .from(schema.resources)
    .innerJoin(schema.subjects, and(
      eq(schema.subjects.id, schema.resources.subjectId),
      eq(schema.subjects.universityId, schema.resources.universityId),
    ))
    .innerJoin(schema.levels, and(
      eq(schema.levels.id, schema.subjects.levelId),
      eq(schema.levels.universityId, schema.subjects.universityId),
    ))
    .innerJoin(schema.programs, and(
      eq(schema.programs.id, schema.levels.programId),
      eq(schema.programs.universityId, schema.levels.universityId),
    ))
    .innerJoin(schema.academicYears, and(
      eq(schema.academicYears.id, schema.subjects.academicYearId),
      eq(schema.academicYears.universityId, schema.subjects.universityId),
    ))
    .where(eq(schema.resources.universityId, universityId));

  return resources
    .map((resource) => ({ ...resource, kind: "resource" as const }))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function getManagedAssignments(universityId: string): Promise<ManagedFile[]> {
  await requireUniversityAdminAccess(universityId);

  const assignments = await db.select({
    id: schema.assignments.id,
    title: schema.assignments.title,
    status: schema.assignments.status,
    createdAt: schema.assignments.createdAt,
    publishedAt: schema.assignments.publishedAt,
    programName: schema.programs.name,
    levelName: schema.levels.name,
    academicYearLabel: schema.academicYears.label,
    subjectName: schema.subjects.name,
  })
    .from(schema.assignments)
    .innerJoin(schema.subjects, and(
      eq(schema.subjects.id, schema.assignments.subjectId),
      eq(schema.subjects.universityId, schema.assignments.universityId),
    ))
    .innerJoin(schema.levels, and(
      eq(schema.levels.id, schema.subjects.levelId),
      eq(schema.levels.universityId, schema.subjects.universityId),
    ))
    .innerJoin(schema.programs, and(
      eq(schema.programs.id, schema.levels.programId),
      eq(schema.programs.universityId, schema.levels.universityId),
    ))
    .innerJoin(schema.academicYears, and(
      eq(schema.academicYears.id, schema.subjects.academicYearId),
      eq(schema.academicYears.universityId, schema.subjects.universityId),
    ))
    .where(eq(schema.assignments.universityId, universityId));

  return assignments
    .map((assignment) => ({ ...assignment, kind: "assignment" as const }))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}
