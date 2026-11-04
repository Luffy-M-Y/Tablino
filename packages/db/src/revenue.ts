import { and, eq, isNotNull, sum, count, max } from "drizzle-orm";
import type { db as sharedDb } from "./client";
import * as schema from "./schema";

type RevenueDatabase = typeof sharedDb;

async function resolveDatabase(database?: RevenueDatabase): Promise<RevenueDatabase> {
  return database ?? (await import("./client")).db;
}

export type SuperAdminRevenueRow = {
  universityId: string;
  universityName: string;
  universityAcronym: string | null;
  totalPaid: number;
  universityAmount: number;
  platformAmount: number;
  paymentsCount: number;
  lastPaymentAt: Date | null;
};

export type SuperAdminRevenueTotals = {
  totalPaid: number;
  universityAmount: number;
  platformAmount: number;
  paymentsCount: number;
};

export type SuperAdminRevenueData = {
  totals: SuperAdminRevenueTotals;
  rows: SuperAdminRevenueRow[];
};

export async function getSuperAdminRevenue(
  database?: RevenueDatabase,
): Promise<SuperAdminRevenueData> {
  const dbInstance = await resolveDatabase(database);

  const universities = await dbInstance
    .select({
      id: schema.universities.id,
      name: schema.universities.name,
      acronym: schema.universities.acronym,
    })
    .from(schema.universities)
    .orderBy(schema.universities.name);

  const revenueRows = await dbInstance
    .select({
      universityId: schema.subscriptions.universityId,
      totalPaid: sum(schema.subscriptions.amount),
      universityAmount: sum(schema.subscriptions.universityAmount),
      platformAmount: sum(schema.subscriptions.platformAmount),
      paymentsCount: count(),
      lastPaymentAt: max(schema.subscriptions.createdAt),
    })
    .from(schema.subscriptions)
    .where(
      and(
        eq(schema.subscriptions.status, "paid"),
        eq(schema.subscriptions.webhookVerified, true),
        isNotNull(schema.subscriptions.universityId),
        eq(schema.subscriptions.currency, "XOF"),
      ),
    )
    .groupBy(schema.subscriptions.universityId);

  const revenueMap = new Map<
    string,
    {
      totalPaid: number;
      universityAmount: number;
      platformAmount: number;
      paymentsCount: number;
      lastPaymentAt: Date | null;
    }
  >();

  for (const row of revenueRows) {
    if (row.universityId) {
      revenueMap.set(row.universityId, {
        totalPaid: Number(row.totalPaid) || 0,
        universityAmount: Number(row.universityAmount) || 0,
        platformAmount: Number(row.platformAmount) || 0,
        paymentsCount: Number(row.paymentsCount) || 0,
        lastPaymentAt: row.lastPaymentAt ? new Date(row.lastPaymentAt) : null,
      });
    }
  }

  const rows: SuperAdminRevenueRow[] = universities.map((u) => {
    const rev = revenueMap.get(u.id);
    return {
      universityId: u.id,
      universityName: u.name,
      universityAcronym: u.acronym,
      totalPaid: rev?.totalPaid ?? 0,
      universityAmount: rev?.universityAmount ?? 0,
      platformAmount: rev?.platformAmount ?? 0,
      paymentsCount: rev?.paymentsCount ?? 0,
      lastPaymentAt: rev?.lastPaymentAt ?? null,
    };
  });

  const totals: SuperAdminRevenueTotals = rows.reduce(
    (acc, row) => ({
      totalPaid: acc.totalPaid + row.totalPaid,
      universityAmount: acc.universityAmount + row.universityAmount,
      platformAmount: acc.platformAmount + row.platformAmount,
      paymentsCount: acc.paymentsCount + row.paymentsCount,
    }),
    { totalPaid: 0, universityAmount: 0, platformAmount: 0, paymentsCount: 0 },
  );

  return { totals, rows };
}
