import { count, eq } from "drizzle-orm";
import { db } from "./client";
import * as schema from "./schema";

export async function getDashboardCounts(universityId: string) {
  const [
    [programs],
    [cycles],
    [levels],
    [academicYears],
    [subjects],
    [resources],
    [assignments],
  ] = await Promise.all([
    db.select({ total: count() }).from(schema.programs)
      .where(eq(schema.programs.universityId, universityId)),
    db.select({ total: count() }).from(schema.cycles)
      .where(eq(schema.cycles.universityId, universityId)),
    db.select({ total: count() }).from(schema.levels)
      .where(eq(schema.levels.universityId, universityId)),
    db.select({ total: count() }).from(schema.academicYears)
      .where(eq(schema.academicYears.universityId, universityId)),
    db.select({ total: count() }).from(schema.subjects)
      .where(eq(schema.subjects.universityId, universityId)),
    db.select({ total: count() }).from(schema.resources)
      .where(eq(schema.resources.universityId, universityId)),
    db.select({ total: count() }).from(schema.assignments)
      .where(eq(schema.assignments.universityId, universityId)),
  ]);

  return {
    programs: programs?.total ?? 0,
    cycles: cycles?.total ?? 0,
    levels: levels?.total ?? 0,
    academicYears: academicYears?.total ?? 0,
    subjects: subjects?.total ?? 0,
    resources: resources?.total ?? 0,
    assignments: assignments?.total ?? 0,
  };
}
