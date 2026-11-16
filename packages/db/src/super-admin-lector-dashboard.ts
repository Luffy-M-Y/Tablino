import { and, asc, count, eq, isNotNull, sql } from "drizzle-orm";
import type { db as sharedDb } from "./client";
import * as schema from "./schema";

type DashboardDatabase = typeof sharedDb;
type UniversityStatus = "pending" | "approved" | "active";

async function resolveDatabase(database?: DashboardDatabase): Promise<DashboardDatabase> {
  return database ?? (await import("./client")).db;
}

export type SuperAdminLectorDashboardData = {
  statusTotals: {
    pending: number;
    approved: number;
    active: number;
  };
  universities: Array<{
    name: string;
    acronym: string | null;
    status: UniversityStatus;
  }>;
  totalStudents: number;
  totalPaid: number;
};

export type SuperAdminLectorDashboardProjectionInput = {
  statusRows: Array<{ status: UniversityStatus; total: number | string | null }>;
  universities: Array<{
    name: string;
    acronym: string | null;
    status: UniversityStatus;
  }>;
  totalStudents: number | string | null;
  totalPaid: number | string | null;
};

function toCount(value: number | string | null): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function projectSuperAdminLectorDashboard(
  input: SuperAdminLectorDashboardProjectionInput,
): SuperAdminLectorDashboardData {
  const statusTotals = { pending: 0, approved: 0, active: 0 };
  for (const row of input.statusRows) {
    statusTotals[row.status] = toCount(row.total);
  }

  return {
    statusTotals,
    universities: input.universities.map(({ name, acronym, status }) => ({
      name,
      acronym,
      status,
    })),
    totalStudents: toCount(input.totalStudents),
    totalPaid: toCount(input.totalPaid),
  };
}

export async function getSuperAdminLectorDashboardData(
  database?: DashboardDatabase,
): Promise<SuperAdminLectorDashboardData> {
  const dbInstance = await resolveDatabase(database);
  const [
    statusRows,
    universities,
    [studentTotal],
    [revenueTotal],
  ] = await Promise.all([
    dbInstance
      .select({
        status: schema.universities.status,
        total: count(),
      })
      .from(schema.universities)
      .groupBy(schema.universities.status),
    dbInstance
      .select({
        name: schema.universities.name,
        acronym: schema.universities.acronym,
        status: schema.universities.status,
      })
      .from(schema.universities)
      .orderBy(asc(schema.universities.name)),
    dbInstance
      .select({ total: count() })
      .from(schema.users)
      .where(and(
        eq(schema.users.role, "student"),
        isNotNull(schema.users.universityId),
      )),
    dbInstance
      .select({
        totalPaid: sql<number>`coalesce(sum(${schema.subscriptions.amount}), 0)`,
      })
      .from(schema.subscriptions)
      .where(and(
        eq(schema.subscriptions.status, "paid"),
        eq(schema.subscriptions.webhookVerified, true),
        isNotNull(schema.subscriptions.universityId),
        eq(schema.subscriptions.currency, "XOF"),
      )),
  ]);

  return projectSuperAdminLectorDashboard({
    statusRows: statusRows.map(({ status, total }) => ({ status, total })),
    universities,
    totalStudents: studentTotal?.total ?? 0,
    totalPaid: revenueTotal?.totalPaid ?? 0,
  });
}
