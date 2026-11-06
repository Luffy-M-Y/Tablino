import "server-only";

import { db, schema } from "@tablino/db";
import { getPublishedSearchCatalog, searchCatalog, type SearchScope } from "@tablino/db";
import { eq, and, count, sql, getTableColumns, desc } from "drizzle-orm";
import { requireStudentUniversityAccess } from "@/lib/authorization";

// ─── Accueil ──────────────────────────────────────────────────────────────────

export async function getHomeCounts(universityId: string) {
  await requireStudentUniversityAccess(universityId);
  const [resources, assignments] = await Promise.all([
    db
      .select({ total: count() })
      .from(schema.resources)
      .innerJoin(schema.subjects, and(
        eq(schema.resources.subjectId, schema.subjects.id),
        eq(schema.resources.universityId, schema.subjects.universityId),
      ))
      .innerJoin(schema.levels, and(
        eq(schema.subjects.levelId, schema.levels.id),
        eq(schema.subjects.universityId, schema.levels.universityId),
      ))
      .innerJoin(schema.programs, and(
        eq(schema.levels.programId, schema.programs.id),
        eq(schema.levels.universityId, schema.programs.universityId),
      ))
      .where(
        and(
          eq(schema.resources.universityId, universityId),
          eq(schema.resources.status, "published"),
          eq(schema.programs.status, "published"),
        ),
      ),
    db
      .select({ total: count() })
      .from(schema.assignments)
      .innerJoin(schema.subjects, and(
        eq(schema.assignments.subjectId, schema.subjects.id),
        eq(schema.assignments.universityId, schema.subjects.universityId),
      ))
      .innerJoin(schema.levels, and(
        eq(schema.subjects.levelId, schema.levels.id),
        eq(schema.subjects.universityId, schema.levels.universityId),
      ))
      .innerJoin(schema.programs, and(
        eq(schema.levels.programId, schema.programs.id),
        eq(schema.levels.universityId, schema.programs.universityId),
      ))
      .where(
        and(
          eq(schema.assignments.universityId, universityId),
          eq(schema.assignments.status, "published"),
          eq(schema.programs.status, "published"),
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
  await requireStudentUniversityAccess(universityId);
  const [programs, levelCounts, subjectCounts] = await Promise.all([
    db
      .select({ id: schema.programs.id, name: schema.programs.name, slug: schema.programs.slug })
      .from(schema.programs)
      .where(and(
        eq(schema.programs.universityId, universityId),
        eq(schema.programs.status, "published"),
      ))
      .orderBy(schema.programs.name),
    db
      .select({ programId: schema.levels.programId, total: count() })
      .from(schema.levels)
      .innerJoin(schema.programs, and(
        eq(schema.levels.programId, schema.programs.id),
        eq(schema.levels.universityId, schema.programs.universityId),
      ))
      .where(and(
        eq(schema.levels.universityId, universityId),
        eq(schema.programs.status, "published"),
      ))
      .groupBy(schema.levels.programId),
    db
      .select({ programId: schema.levels.programId, total: sql<number>`count(distinct ${schema.subjects.slug})`.mapWith(Number) })
      .from(schema.subjects)
      .innerJoin(schema.levels, and(
        eq(schema.subjects.levelId, schema.levels.id),
        eq(schema.subjects.universityId, schema.levels.universityId),
      ))
      .innerJoin(schema.programs, and(
        eq(schema.levels.programId, schema.programs.id),
        eq(schema.levels.universityId, schema.programs.universityId),
      ))
      .where(and(
        eq(schema.subjects.universityId, universityId),
        eq(schema.programs.status, "published"),
      ))
      .groupBy(schema.levels.programId),
  ]);

  const lvlMap = new Map(levelCounts.map((r) => [r.programId, r.total]));
  const subMap = new Map(subjectCounts.map((r) => [r.programId, r.total]));

  return programs.map((p) => ({
    ...p,
    levelCount: lvlMap.get(p.id) ?? 0,
    subjectCount: subMap.get(p.id) ?? 0,
  }));
}

// ─── Niveaux ──────────────────────────────────────────────────────────────────

export async function getProgramBySlug(universityId: string, slug: string) {
  await requireStudentUniversityAccess(universityId);
  const rows = await db
    .select(getTableColumns(schema.programs))
    .from(schema.programs)
    .where(
      and(
        eq(schema.programs.universityId, universityId),
        eq(schema.programs.slug, slug),
        eq(schema.programs.status, "published"),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function getLevelsByProgram(universityId: string, programId: string) {
  await requireStudentUniversityAccess(universityId);
  const rows = await db
    .select({
      cycleId: schema.cycles.id,
      cycleName: schema.cycles.name,
      levelId: schema.levels.id,
      levelName: schema.levels.name,
      levelSlug: schema.levels.slug,
    })
    .from(schema.levels)
    .innerJoin(schema.cycles, and(
      eq(schema.cycles.id, schema.levels.cycleId),
      eq(schema.cycles.universityId, schema.levels.universityId),
    ))
    .innerJoin(schema.programs, and(
      eq(schema.programs.id, schema.levels.programId),
      eq(schema.programs.universityId, schema.levels.universityId),
    ))
    .where(
      and(
        eq(schema.levels.universityId, universityId),
        eq(schema.levels.programId, programId),
        eq(schema.programs.status, "published"),
      ),
    )
    .orderBy(schema.cycles.order, schema.levels.yearNumber);

  const cycles = new Map<string, {
    id: string;
    name: string;
    levels: { id: string; name: string; slug: string }[];
  }>();

  for (const row of rows) {
    let cycle = cycles.get(row.cycleId);
    if (!cycle) {
      cycle = { id: row.cycleId, name: row.cycleName, levels: [] };
      cycles.set(row.cycleId, cycle);
    }
    cycle.levels.push({ id: row.levelId, name: row.levelName, slug: row.levelSlug });
  }

  return Array.from(cycles.values());
}

// ─── Années ───────────────────────────────────────────────────────────────────

export async function getLevelBySlug(universityId: string, programId: string, slug: string) {
  await requireStudentUniversityAccess(universityId);
  const rows = await db
    .select(getTableColumns(schema.levels))
    .from(schema.levels)
    .innerJoin(schema.programs, and(
      eq(schema.programs.id, schema.levels.programId),
      eq(schema.programs.universityId, schema.levels.universityId),
    ))
    .where(
      and(
        eq(schema.levels.universityId, universityId),
        eq(schema.levels.programId, programId),
        eq(schema.levels.slug, slug),
        eq(schema.programs.status, "published"),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function getAcademicYearsByLevel(universityId: string, levelId: string) {
  await requireStudentUniversityAccess(universityId);
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
    .innerJoin(schema.levels, and(
      eq(schema.subjects.levelId, schema.levels.id),
      eq(schema.subjects.universityId, schema.levels.universityId),
    ))
    .innerJoin(schema.programs, and(
      eq(schema.levels.programId, schema.programs.id),
      eq(schema.levels.universityId, schema.programs.universityId),
    ))
    .where(
      and(
        eq(schema.subjects.universityId, universityId),
        eq(schema.subjects.levelId, levelId),
        eq(schema.programs.status, "published"),
      ),
    )
    .orderBy(desc(schema.academicYears.label));
  return rows;
}

// ─── Matières ─────────────────────────────────────────────────────────────────

export async function getAcademicYearByLabel(universityId: string, label: string) {
  await requireStudentUniversityAccess(universityId);
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
  await requireStudentUniversityAccess(universityId);
  return db
    .select(getTableColumns(schema.subjects))
    .from(schema.subjects)
    .innerJoin(schema.levels, and(
      eq(schema.subjects.levelId, schema.levels.id),
      eq(schema.subjects.universityId, schema.levels.universityId),
    ))
    .innerJoin(schema.programs, and(
      eq(schema.levels.programId, schema.programs.id),
      eq(schema.levels.universityId, schema.programs.universityId),
    ))
    .where(
      and(
        eq(schema.subjects.universityId, universityId),
        eq(schema.subjects.levelId, levelId),
        eq(schema.subjects.academicYearId, academicYearId),
        eq(schema.programs.status, "published"),
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
  await requireStudentUniversityAccess(universityId);
  const rows = await db
    .select(getTableColumns(schema.subjects))
    .from(schema.subjects)
    .innerJoin(schema.levels, and(
      eq(schema.subjects.levelId, schema.levels.id),
      eq(schema.subjects.universityId, schema.levels.universityId),
    ))
    .innerJoin(schema.programs, and(
      eq(schema.levels.programId, schema.programs.id),
      eq(schema.levels.universityId, schema.programs.universityId),
    ))
    .where(
      and(
        eq(schema.subjects.universityId, universityId),
        eq(schema.subjects.levelId, levelId),
        eq(schema.subjects.academicYearId, academicYearId),
        eq(schema.subjects.slug, slug),
        eq(schema.programs.status, "published"),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function getResourcesBySubject(universityId: string, subjectId: string) {
  await requireStudentUniversityAccess(universityId);
  return db
    .select(getTableColumns(schema.resources))
    .from(schema.resources)
    .innerJoin(schema.subjects, and(
      eq(schema.resources.subjectId, schema.subjects.id),
      eq(schema.resources.universityId, schema.subjects.universityId),
    ))
    .innerJoin(schema.levels, and(
      eq(schema.subjects.levelId, schema.levels.id),
      eq(schema.subjects.universityId, schema.levels.universityId),
    ))
    .innerJoin(schema.programs, and(
      eq(schema.levels.programId, schema.programs.id),
      eq(schema.levels.universityId, schema.programs.universityId),
    ))
    .where(
      and(
        eq(schema.resources.universityId, universityId),
        eq(schema.resources.subjectId, subjectId),
        eq(schema.resources.status, "published"),
        eq(schema.programs.status, "published"),
      ),
    )
    .orderBy(schema.resources.publishedAt);
}

// ─── Devoirs ──────────────────────────────────────────────────────────────────

export async function getAssignmentsBySubject(universityId: string, subjectId: string) {
  await requireStudentUniversityAccess(universityId);
  return db
    .select(getTableColumns(schema.assignments))
    .from(schema.assignments)
    .innerJoin(schema.subjects, and(
      eq(schema.assignments.subjectId, schema.subjects.id),
      eq(schema.assignments.universityId, schema.subjects.universityId),
    ))
    .innerJoin(schema.levels, and(
      eq(schema.subjects.levelId, schema.levels.id),
      eq(schema.subjects.universityId, schema.levels.universityId),
    ))
    .innerJoin(schema.programs, and(
      eq(schema.levels.programId, schema.programs.id),
      eq(schema.levels.universityId, schema.programs.universityId),
    ))
    .where(
      and(
        eq(schema.assignments.universityId, universityId),
        eq(schema.assignments.subjectId, subjectId),
        eq(schema.assignments.status, "published"),
        eq(schema.programs.status, "published"),
      ),
    )
    .orderBy(schema.assignments.dueDate);
}

export async function searchPublishedCatalog(universityId: string, query: string, scope: SearchScope) {
  await requireStudentUniversityAccess(universityId);
  const catalog = await getPublishedSearchCatalog(universityId);
  return searchCatalog(catalog, query, scope);
}
