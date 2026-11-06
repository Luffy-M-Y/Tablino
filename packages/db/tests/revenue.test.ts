import assert from "node:assert/strict";
import test from "node:test";
import { getSuperAdminRevenue } from "../src/revenue";

type SelectQuery = {
  from: (table: unknown) => SelectQuery;
  innerJoin: (table: unknown, condition: unknown) => SelectQuery;
  where: (condition: unknown) => SelectQuery;
  orderBy: (order: unknown) => SelectQuery;
  groupBy: (...columns: unknown[]) => SelectQuery;
  limit: (count: number) => Promise<unknown[]>;
  then: (
    onFulfilled?: ((value: unknown) => unknown) | null,
    onRejected?: ((reason: unknown) => unknown) | null,
  ) => Promise<unknown>;
};

function createMemoryDatabase(selectedRows: unknown[][] = []) {
  const selects: Array<{ table?: unknown; condition?: unknown }> = [];

  const buildSelectQuery = (): SelectQuery => {
    const record: { table?: unknown; condition?: unknown } = {};
    selects.push(record);
    const query: SelectQuery = {
      from: (table) => {
        record.table = table;
        return query;
      },
      innerJoin: () => query,
      where: (condition) => {
        record.condition = condition;
        return query;
      },
      orderBy: () => query,
      groupBy: () => query,
      limit: async () => selectedRows.shift() ?? [],
      then: (onFulfilled, onRejected) => {
        const result = selectedRows.shift() ?? [];
        return Promise.resolve(result).then(onFulfilled, onRejected);
      },
    };
    return query;
  };

  return {
    database: {
      select: buildSelectQuery,
    } as never,
    selects,
  };
}

test("getSuperAdminRevenue aggregates revenue and handles universities without payments", async () => {
  const lastPaymentUniv1 = new Date("2026-10-30T14:30:00.000Z");
  const lastPaymentUniv3 = new Date("2026-10-28T09:15:00.000Z");

  const fakeDb = createMemoryDatabase([
    // 1. Universities list
    [
      { id: "univ-1", name: "Université Alpha", acronym: "UA" },
      { id: "univ-2", name: "Université Beta", acronym: "UB" },
      { id: "univ-3", name: "Université Gamma", acronym: null },
    ],
    // 2. Revenue rows (SUM, COUNT, MAX)
    [
      {
        universityId: "univ-1",
        totalPaid: "10000",
        universityAmount: "7000",
        platformAmount: "3000",
        paymentsCount: "5",
        lastPaymentAt: lastPaymentUniv1,
      },
      {
        universityId: "univ-3",
        totalPaid: "2500",
        universityAmount: "1750",
        platformAmount: "750",
        paymentsCount: "1",
        lastPaymentAt: lastPaymentUniv3,
      },
    ],
  ]);

  const data = await getSuperAdminRevenue(fakeDb.database);

  assert.equal(data.rows.length, 3);

  // Totals
  assert.deepEqual(data.totals, {
    totalPaid: 12500,
    universityAmount: 8750,
    platformAmount: 3750,
    paymentsCount: 6,
  });

  // University 1: has payments
  const univ1 = data.rows.find((r) => r.universityId === "univ-1");
  assert.ok(univ1);
  assert.equal(univ1.universityName, "Université Alpha");
  assert.equal(univ1.universityAcronym, "UA");
  assert.equal(univ1.totalPaid, 10000);
  assert.equal(univ1.universityAmount, 7000);
  assert.equal(univ1.platformAmount, 3000);
  assert.equal(univ1.paymentsCount, 5);
  assert.equal(univ1.lastPaymentAt?.getTime(), lastPaymentUniv1.getTime());

  // University 2: without payments => all zeros and null lastPaymentAt
  const univ2 = data.rows.find((r) => r.universityId === "univ-2");
  assert.ok(univ2);
  assert.equal(univ2.universityName, "Université Beta");
  assert.equal(univ2.universityAcronym, "UB");
  assert.equal(univ2.totalPaid, 0);
  assert.equal(univ2.universityAmount, 0);
  assert.equal(univ2.platformAmount, 0);
  assert.equal(univ2.paymentsCount, 0);
  assert.equal(univ2.lastPaymentAt, null);

  // University 3: single payment
  const univ3 = data.rows.find((r) => r.universityId === "univ-3");
  assert.ok(univ3);
  assert.equal(univ3.universityName, "Université Gamma");
  assert.equal(univ3.universityAcronym, null);
  assert.equal(univ3.totalPaid, 2500);
  assert.equal(univ3.universityAmount, 1750);
  assert.equal(univ3.platformAmount, 750);
  assert.equal(univ3.paymentsCount, 1);
  assert.equal(univ3.lastPaymentAt?.getTime(), lastPaymentUniv3.getTime());
});
