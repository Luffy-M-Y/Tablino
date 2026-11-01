import { and, asc, count, eq, gt, isNotNull, max } from "drizzle-orm";
import type { db as sharedDb } from "./client";
import * as schema from "./schema";

type DashboardDatabase = typeof sharedDb;

async function resolveDatabase(database?: DashboardDatabase): Promise<DashboardDatabase> {
  return database ?? (await import("./client")).db;
}

export type SuperAdminStatusTotals = {
  pending: number;
  approved: number;
  active: number;
};

export type SuperAdminUniversityRow = {
  id: string;
  name: string;
  acronym: string | null;
  status: "pending" | "approved" | "active";
  studentsCount: number;
  publishedResourcesCount: number;
  publishedAssignmentsCount: number;
  openSessionsCount: number;
  lastActivityAt: Date | null;
};

export type SuperAdminDashboardData = {
  totalStudents: number;
  statusTotals: SuperAdminStatusTotals;
  universities: SuperAdminUniversityRow[];
};

export async function getDashboardCounts(universityId: string, database?: DashboardDatabase) {
  const dbInstance = await resolveDatabase(database);
  const [
    [programs],
    [cycles],
    [subjects],
    [resources],
    [assignments],
  ] = await Promise.all([
    dbInstance.select({ total: count() }).from(schema.programs)
      .where(eq(schema.programs.universityId, universityId)),
    dbInstance.select({ total: count() }).from(schema.cycles)
      .where(eq(schema.cycles.universityId, universityId)),
    dbInstance.select({ total: count() }).from(schema.subjects)
      .where(eq(schema.subjects.universityId, universityId)),
    dbInstance.select({ total: count() }).from(schema.resources)
      .where(and(
        eq(schema.resources.universityId, universityId),
        eq(schema.resources.status, "published"),
      )),
    dbInstance.select({ total: count() }).from(schema.assignments)
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

export async function getSuperAdminDashboardData(
  database?: DashboardDatabase,
): Promise<SuperAdminDashboardData> {
  const dbInstance = await resolveDatabase(database);
  const now = new Date();

  const [
    universities,
    studentCounts,
    resourceCounts,
    assignmentCounts,
    sessionCounts,
    latestResourceDates,
    latestAssignmentDates,
    latestUserDates,
  ] = await Promise.all([
    dbInstance
      .select({
        id: schema.universities.id,
        name: schema.universities.name,
        acronym: schema.universities.acronym,
        status: schema.universities.status,
      })
      .from(schema.universities)
      .orderBy(asc(schema.universities.name)),
    dbInstance
      .select({
        universityId: schema.users.universityId,
        total: count(),
      })
      .from(schema.users)
      .where(and(eq(schema.users.role, "student"), isNotNull(schema.users.universityId)))
      .groupBy(schema.users.universityId),
    dbInstance
      .select({
        universityId: schema.resources.universityId,
        total: count(),
      })
      .from(schema.resources)
      .where(eq(schema.resources.status, "published"))
      .groupBy(schema.resources.universityId),
    dbInstance
      .select({
        universityId: schema.assignments.universityId,
        total: count(),
      })
      .from(schema.assignments)
      .where(eq(schema.assignments.status, "published"))
      .groupBy(schema.assignments.universityId),
    dbInstance
      .select({
        universityId: schema.users.universityId,
        total: count(),
      })
      .from(schema.sessions)
      .innerJoin(schema.users, eq(schema.sessions.userId, schema.users.id))
      .where(and(gt(schema.sessions.expires, now), isNotNull(schema.users.universityId)))
      .groupBy(schema.users.universityId),
    dbInstance
      .select({
        universityId: schema.resources.universityId,
        latestAt: max(schema.resources.createdAt),
      })
      .from(schema.resources)
      .groupBy(schema.resources.universityId),
    dbInstance
      .select({
        universityId: schema.assignments.universityId,
        latestAt: max(schema.assignments.createdAt),
      })
      .from(schema.assignments)
      .groupBy(schema.assignments.universityId),
    dbInstance
      .select({
        universityId: schema.users.universityId,
        latestAt: max(schema.users.createdAt),
      })
      .from(schema.users)
      .where(isNotNull(schema.users.universityId))
      .groupBy(schema.users.universityId),
  ]);

  const studentCountsMap = new Map<string, number>();
  for (const row of studentCounts) {
    if (row.universityId) studentCountsMap.set(row.universityId, Number(row.total));
  }

  const resourceCountsMap = new Map<string, number>();
  for (const row of resourceCounts) {
    if (row.universityId) resourceCountsMap.set(row.universityId, Number(row.total));
  }

  const assignmentCountsMap = new Map<string, number>();
  for (const row of assignmentCounts) {
    if (row.universityId) assignmentCountsMap.set(row.universityId, Number(row.total));
  }

  const sessionCountsMap = new Map<string, number>();
  for (const row of sessionCounts) {
    if (row.universityId) sessionCountsMap.set(row.universityId, Number(row.total));
  }

  const latestActivityMap = new Map<string, Date>();
  function recordLatest(univId: string | null, date: Date | null | undefined) {
    if (!univId || !date) return;
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return;
    const current = latestActivityMap.get(univId);
    if (!current || parsed > current) {
      latestActivityMap.set(univId, parsed);
    }
  }

  for (const row of latestResourceDates) {
    recordLatest(row.universityId, row.latestAt);
  }
  for (const row of latestAssignmentDates) {
    recordLatest(row.universityId, row.latestAt);
  }
  for (const row of latestUserDates) {
    recordLatest(row.universityId, row.latestAt);
  }

  const statusTotals: SuperAdminStatusTotals = {
    pending: 0,
    approved: 0,
    active: 0,
  };

  const rows: SuperAdminUniversityRow[] = universities.map((u) => {
    if (u.status === "pending" || u.status === "approved" || u.status === "active") {
      statusTotals[u.status]++;
    }

    return {
      id: u.id,
      name: u.name,
      acronym: u.acronym,
      status: u.status,
      studentsCount: studentCountsMap.get(u.id) ?? 0,
      publishedResourcesCount: resourceCountsMap.get(u.id) ?? 0,
      publishedAssignmentsCount: assignmentCountsMap.get(u.id) ?? 0,
      openSessionsCount: sessionCountsMap.get(u.id) ?? 0,
      lastActivityAt: latestActivityMap.get(u.id) ?? null,
    };
  });

  const totalStudents = rows.reduce((acc, u) => acc + u.studentsCount, 0);

  return {
    totalStudents,
    statusTotals,
    universities: rows,
  };
}
