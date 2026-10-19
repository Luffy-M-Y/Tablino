import { db, schema } from "@tablino/db";
import { eq, and, count, sql } from "drizzle-orm";

// ─── Accueil ──────────────────────────────────────────────────────────────────

export async function getHomeCounts(universityId: string) {
  const [resources, assignments] = await Promise.all([
    db
      .select({ total: count() })
      .from(schema.resources)
      .where(
        and(
          eq(schema.resources.universityId, universityId),
          eq(schema.resources.status, "published"),
        ),
      ),
    db
      .select({ total: count() })
      .from(schema.assignments)
      .where(
        and(
          eq(schema.assignments.universityId, universityId),
          eq(schema.assignments.status, "published"),
        ),
      ),
  ]);
  return {
    resourceCount: resources[0]?.total ?? 0,
    assignmentCount: assignments[0]?.total ?? 0,
  };
}

// ─── Filières ─────────────────────────────────────────────────────────────────

export async function getPrograms(universityId: string) {
  const rows = await db
    .select({
      id: schema.programs.id,
      name: schema.programs.name,
      slug: schema.programs.slug,
      levelCount: sql<number>`(
        select count(*) from levels
        where levels.program_id = ${schema.programs.id}
          and levels.university_id = ${schema.programs.universityId}
      )`.mapWith(Number),
      subjectCount: sql<number>`(
        select count(*) from subjects
        where subjects.university_id = ${schema.programs.universityId}
          and subjects.level_id in (
            select id from levels
            where levels.program_id = ${schema.programs.id}
              and levels.university_id = ${schema.programs.universityId}
          )
      )`.mapWith(Number),
    })
    .from(schema.programs)
    .where(eq(schema.programs.universityId, universityId))
    .orderBy(schema.programs.name);
  return rows;
}

// ─── Niveaux ──────────────────────────────────────────────────────────────────

export async function getProgramBySlug(universityId: string, slug: string) {
  const rows = await db
    .select()
    .from(schema.programs)
    .where(
      and(
        eq(schema.programs.universityId, universityId),
        eq(schema.programs.slug, slug),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function getLevelsByProgram(universityId: string, programId: string) {
  return db
    .select()
    .from(schema.levels)
    .where(
      and(
        eq(schema.levels.universityId, universityId),
        eq(schema.levels.programId, programId),
      ),
    )
    .orderBy(schema.levels.order);
}

// ─── Années ───────────────────────────────────────────────────────────────────

export async function getLevelBySlug(universityId: string, programId: string, slug: string) {
  const rows = await db
    .select()
    .from(schema.levels)
    .where(
      and(
        eq(schema.levels.universityId, universityId),
        eq(schema.levels.programId, programId),
        eq(schema.levels.slug, slug),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function getAcademicYearsByLevel(universityId: string, levelId: string) {
  // DISTINCT academic_year_id depuis subjects, jointure sur academic_years
  const rows = await db
    .selectDistinct({
      id: schema.academicYears.id,
      label: schema.academicYears.label,
      startsAt: schema.academicYears.startsAt,
      endsAt: schema.academicYears.endsAt,
    })
    .from(schema.subjects)
    .innerJoin(
      schema.academicYears,
      and(
        eq(schema.subjects.academicYearId, schema.academicYears.id),
        eq(schema.subjects.universityId, schema.academicYears.universityId),
      ),
    )
    .where(
      and(
        eq(schema.subjects.universityId, universityId),
        eq(schema.subjects.levelId, levelId),
      ),
    )
    .orderBy(schema.academicYears.label);
  return rows;
}

// ─── Matières ─────────────────────────────────────────────────────────────────

export async function getAcademicYearByLabel(universityId: string, label: string) {
  const rows = await db
    .select()
    .from(schema.academicYears)
    .where(
      and(
        eq(schema.academicYears.universityId, universityId),
        eq(schema.academicYears.label, label),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function getSubjectsByLevelAndYear(
  universityId: string,
  levelId: string,
  academicYearId: string,
) {
  return db
    .select()
    .from(schema.subjects)
    .where(
      and(
        eq(schema.subjects.universityId, universityId),
        eq(schema.subjects.levelId, levelId),
        eq(schema.subjects.academicYearId, academicYearId),
      ),
    )
    .orderBy(schema.subjects.name);
}

// ─── Ressources (cours) ───────────────────────────────────────────────────────

export async function getSubjectBySlug(
  universityId: string,
  levelId: string,
  academicYearId: string,
  slug: string,
) {
  const rows = await db
    .select()
    .from(schema.subjects)
    .where(
      and(
        eq(schema.subjects.universityId, universityId),
        eq(schema.subjects.levelId, levelId),
        eq(schema.subjects.academicYearId, academicYearId),
        eq(schema.subjects.slug, slug),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function getResourcesBySubject(universityId: string, subjectId: string) {
  return db
    .select()
    .from(schema.resources)
    .where(
      and(
        eq(schema.resources.universityId, universityId),
        eq(schema.resources.subjectId, subjectId),
        eq(schema.resources.status, "published"),
      ),
    )
    .orderBy(schema.resources.publishedAt);
}

// ─── Devoirs ──────────────────────────────────────────────────────────────────

export async function getAssignmentsBySubject(universityId: string, subjectId: string) {
  return db
    .select()
    .from(schema.assignments)
    .where(
      and(
        eq(schema.assignments.universityId, universityId),
        eq(schema.assignments.subjectId, subjectId),
        eq(schema.assignments.status, "published"),
      ),
    )
    .orderBy(schema.assignments.dueDate);
}
