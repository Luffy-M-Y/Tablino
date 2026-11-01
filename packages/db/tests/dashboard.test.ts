import assert from "node:assert/strict";
import test from "node:test";
import { getDashboardCounts, getSuperAdminDashboardData } from "../src/dashboard";

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

test("getDashboardCounts returns aggregated totals for university admin", async () => {
  const fakeDb = createMemoryDatabase([
    [{ total: 4 }], // programs
    [{ total: 2 }], // cycles
    [{ total: 10 }], // subjects
    [{ total: 25 }], // resources
    [{ total: 8 }], // assignments
  ]);

  const counts = await getDashboardCounts("univ-1", fakeDb.database);
  assert.deepEqual(counts, {
    programs: 4,
    cycles: 2,
    subjects: 10,
    resources: 25,
    assignments: 8,
  });
});

test("getSuperAdminDashboardData aggregates status totals, metrics, sessions, and activity per university", async () => {
  const recentDate = new Date("2026-10-31T12:00:00.000Z");
  const olderDate = new Date("2026-10-20T08:00:00.000Z");

  const fakeUniversities = [
    { id: "univ-1", name: "Université Alpha", acronym: "UA", status: "active" },
    { id: "univ-2", name: "Université Beta", acronym: "UB", status: "pending" },
    { id: "univ-3", name: "Université Gamma", acronym: null, status: "approved" },
  ];

  const fakeStudents = [
    { universityId: "univ-1", total: 150 },
    { universityId: "univ-3", total: 42 },
  ];

  const fakeResources = [
    { universityId: "univ-1", total: 30 },
  ];

  const fakeAssignments = [
    { universityId: "univ-1", total: 12 },
  ];

  const fakeSessions = [
    { universityId: "univ-1", total: 5 },
    { universityId: "univ-3", total: 2 },
  ];

  const fakeLatestResources = [
    { universityId: "univ-1", latestAt: olderDate },
  ];

  const fakeLatestAssignments = [
    { universityId: "univ-1", latestAt: recentDate },
  ];

  const fakeLatestUsers = [
    { universityId: "univ-2", latestAt: olderDate },
  ];

  const fakeDb = createMemoryDatabase([
    fakeUniversities,
    fakeStudents,
    fakeResources,
    fakeAssignments,
    fakeSessions,
    fakeLatestResources,
    fakeLatestAssignments,
    fakeLatestUsers,
  ]);

  const data = await getSuperAdminDashboardData(fakeDb.database);

  assert.deepEqual(data.statusTotals, {
    pending: 1,
    approved: 1,
    active: 1,
  });

  assert.equal(data.totalStudents, 192);
  assert.equal(data.universities.length, 3);

  // University 1: active, 150 students, 30 resources, 12 assignments, 5 open sessions, latest activity = recentDate
  const univ1 = data.universities.find((u) => u.id === "univ-1");
  assert.ok(univ1);
  assert.equal(univ1.name, "Université Alpha");
  assert.equal(univ1.acronym, "UA");
  assert.equal(univ1.status, "active");
  assert.equal(univ1.studentsCount, 150);
  assert.equal(univ1.publishedResourcesCount, 30);
  assert.equal(univ1.publishedAssignmentsCount, 12);
  assert.equal(univ1.openSessionsCount, 5);
  assert.equal(univ1.lastActivityAt?.getTime(), recentDate.getTime());

  // University 2: pending, 0 students, 0 resources, 0 assignments, 0 open sessions, latest activity = olderDate
  const univ2 = data.universities.find((u) => u.id === "univ-2");
  assert.ok(univ2);
  assert.equal(univ2.name, "Université Beta");
  assert.equal(univ2.acronym, "UB");
  assert.equal(univ2.status, "pending");
  assert.equal(univ2.studentsCount, 0);
  assert.equal(univ2.publishedResourcesCount, 0);
  assert.equal(univ2.publishedAssignmentsCount, 0);
  assert.equal(univ2.openSessionsCount, 0);
  assert.equal(univ2.lastActivityAt?.getTime(), olderDate.getTime());

  // University 3: approved, 42 students, 0 resources, 0 assignments, 2 open sessions, no activity recorded
  const univ3 = data.universities.find((u) => u.id === "univ-3");
  assert.ok(univ3);
  assert.equal(univ3.name, "Université Gamma");
  assert.equal(univ3.acronym, null);
  assert.equal(univ3.status, "approved");
  assert.equal(univ3.studentsCount, 42);
  assert.equal(univ3.publishedResourcesCount, 0);
  assert.equal(univ3.publishedAssignmentsCount, 0);
  assert.equal(univ3.openSessionsCount, 2);
  assert.equal(univ3.lastActivityAt, null);
});
