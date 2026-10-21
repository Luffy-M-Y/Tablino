import { and, count, eq } from "drizzle-orm";
import { db } from "./client";
import * as schema from "./schema";

export async function getDashboardCounts(universityId: string) {
  const [
    [programs],
    [cycles],
    [subjects],
    [resources],
    [assignments],
  ] = await Promise.all([
    db.select({ total: count() }).from(schema.programs)
      .where(eq(schema.programs.universityId, universityId)),
    db.select({ total: count() }).from(schema.cycles)
      .where(eq(schema.cycles.universityId, universityId)),
    db.select({ total: count() }).from(schema.subjects)
      .where(eq(schema.subjects.universityId, universityId)),
    db.select({ total: count() }).from(schema.resources)
      .where(and(
        eq(schema.resources.universityId, universityId),
        eq(schema.resources.status, "published"),
      )),
    db.select({ total: count() }).from(schema.assignments)
      .where(and(
        eq(schema.assignments.universityId, universityId),
        eq(schema.assignments.status, "published"),
      )),
  ]);

  return {
    programs: programs?.total ?? 0,
    cycles: cycles?.total ?? 0,
    subjects: subjects?.total ?? 0,
    resources: resources?.total ?? 0,
    assignments: assignments?.total ?? 0,
  };
}
