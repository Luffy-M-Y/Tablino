import "server-only";

import { and, asc, db, eq, schema } from "@tablino/db";
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

export type DraftItem = {
  id: string;
  kind: "resource" | "assignment";
  title: string;
  createdAt: Date;
  subjectName: string;
  levelName: string;
  programName: string;
  programStatus: "draft" | "published";
};

export type DraftProgram = { id: string; name: string };

export async function getDraftProgramsForUniversity(universityId: string): Promise<DraftProgram[]> {
  await requireUniversityAdminAccess(universityId);

  return db.select({
    id: schema.programs.id,
    name: schema.programs.name,
  })
    .from(schema.programs)
    .where(and(
      eq(schema.programs.universityId, universityId),
      eq(schema.programs.status, "draft"),
    ))
    .orderBy(asc(schema.programs.name));
}

export async function getDraftsForUniversity(universityId: string): Promise<DraftItem[]> {
  await requireUniversityAdminAccess(universityId);

  const [resources, assignments] = await Promise.all([
    db.select({
      id: schema.resources.id,
      title: schema.resources.title,
      createdAt: schema.resources.createdAt,
      subjectName: schema.subjects.name,
      levelName: schema.levels.name,
      programName: schema.programs.name,
      programStatus: schema.programs.status,
    })
      .from(schema.resources)
      .innerJoin(schema.subjects, and(
        eq(schema.subjects.id, schema.resources.subjectId),
        eq(schema.subjects.universityId, schema.resources.universityId),
      ))
      .innerJoin(schema.levels, eq(schema.levels.id, schema.subjects.levelId))
      .innerJoin(schema.programs, eq(schema.programs.id, schema.levels.programId))
      .where(and(
        eq(schema.resources.universityId, universityId),
        eq(schema.resources.status, "draft"),
      )),
    db.select({
      id: schema.assignments.id,
      title: schema.assignments.title,
      createdAt: schema.assignments.createdAt,
      subjectName: schema.subjects.name,
      levelName: schema.levels.name,
      programName: schema.programs.name,
      programStatus: schema.programs.status,
    })
      .from(schema.assignments)
      .innerJoin(schema.subjects, and(
        eq(schema.subjects.id, schema.assignments.subjectId),
        eq(schema.subjects.universityId, schema.assignments.universityId),
      ))
      .innerJoin(schema.levels, eq(schema.levels.id, schema.subjects.levelId))
      .innerJoin(schema.programs, eq(schema.programs.id, schema.levels.programId))
      .where(and(
        eq(schema.assignments.universityId, universityId),
        eq(schema.assignments.status, "draft"),
      )),
  ]);

  const draftItems: DraftItem[] = [
    ...resources.map((resource) => ({ ...resource, kind: "resource" as const })),
    ...assignments.map((assignment) => ({ ...assignment, kind: "assignment" as const })),
  ];

  return draftItems.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}
