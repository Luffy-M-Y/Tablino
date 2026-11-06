import { and, asc, eq } from "drizzle-orm";
import type { db as sharedDb } from "./client";
import type { SearchCatalog } from "./search-catalog";
import * as schema from "./schema";

type SearchCatalogDatabase = typeof sharedDb;

async function resolveDatabase(database?: SearchCatalogDatabase): Promise<SearchCatalogDatabase> {
  return database ?? (await import("./client")).db;
}

export async function getPublishedSearchCatalog(
  universityId: string,
  database?: SearchCatalogDatabase,
): Promise<SearchCatalog> {
  const db = await resolveDatabase(database);

  const programs = await db
    .select({ name: schema.programs.name, slug: schema.programs.slug })
    .from(schema.programs)
    .where(and(
      eq(schema.programs.universityId, universityId),
      eq(schema.programs.status, "published"),
    ))
    .orderBy(asc(schema.programs.name));

  const subjects = await db
    .select({
      programName: schema.programs.name,
      programSlug: schema.programs.slug,
      cycleName: schema.cycles.name,
      levelName: schema.levels.name,
      levelSlug: schema.levels.slug,
      yearLabel: schema.academicYears.label,
      subjectName: schema.subjects.name,
      subjectSlug: schema.subjects.slug,
    })
    .from(schema.subjects)
    .innerJoin(schema.levels, and(
      eq(schema.levels.id, schema.subjects.levelId),
      eq(schema.levels.universityId, schema.subjects.universityId),
    ))
    .innerJoin(schema.programs, and(
      eq(schema.programs.id, schema.levels.programId),
      eq(schema.programs.universityId, schema.levels.universityId),
    ))
    .innerJoin(schema.cycles, and(
      eq(schema.cycles.id, schema.levels.cycleId),
      eq(schema.cycles.universityId, schema.levels.universityId),
    ))
    .innerJoin(schema.academicYears, and(
      eq(schema.academicYears.id, schema.subjects.academicYearId),
      eq(schema.academicYears.universityId, schema.subjects.universityId),
    ))
    .where(and(
      eq(schema.subjects.universityId, universityId),
      eq(schema.programs.status, "published"),
    ))
    .orderBy(asc(schema.subjects.name));

  const resources = await db
    .select({
      programName: schema.programs.name,
      programSlug: schema.programs.slug,
      cycleName: schema.cycles.name,
      levelName: schema.levels.name,
      levelSlug: schema.levels.slug,
      yearLabel: schema.academicYears.label,
      subjectName: schema.subjects.name,
      subjectSlug: schema.subjects.slug,
      title: schema.resources.title,
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
    .innerJoin(schema.cycles, and(
      eq(schema.cycles.id, schema.levels.cycleId),
      eq(schema.cycles.universityId, schema.levels.universityId),
    ))
    .innerJoin(schema.academicYears, and(
      eq(schema.academicYears.id, schema.subjects.academicYearId),
      eq(schema.academicYears.universityId, schema.subjects.universityId),
    ))
    .where(and(
      eq(schema.resources.universityId, universityId),
      eq(schema.resources.status, "published"),
      eq(schema.programs.status, "published"),
    ))
    .orderBy(asc(schema.resources.title));

  const assignments = await db
    .select({
      programName: schema.programs.name,
      programSlug: schema.programs.slug,
      cycleName: schema.cycles.name,
      levelName: schema.levels.name,
      levelSlug: schema.levels.slug,
      yearLabel: schema.academicYears.label,
      subjectName: schema.subjects.name,
      subjectSlug: schema.subjects.slug,
      title: schema.assignments.title,
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
    .innerJoin(schema.cycles, and(
      eq(schema.cycles.id, schema.levels.cycleId),
      eq(schema.cycles.universityId, schema.levels.universityId),
    ))
    .innerJoin(schema.academicYears, and(
      eq(schema.academicYears.id, schema.subjects.academicYearId),
      eq(schema.academicYears.universityId, schema.subjects.universityId),
    ))
    .where(and(
      eq(schema.assignments.universityId, universityId),
      eq(schema.assignments.status, "published"),
      eq(schema.programs.status, "published"),
    ))
    .orderBy(asc(schema.assignments.title));

  return { programs, subjects, resources, assignments };
}
