import assert from "node:assert/strict";
import test from "node:test";
import {
  approveUniversity,
  listPendingUniversitiesForApproval,
} from "../src/university-approval";

type SelectQuery = {
  from: (table: unknown) => SelectQuery;
  innerJoin: (table: unknown, condition: unknown) => SelectQuery;
  where: (condition: unknown) => SelectQuery;
  orderBy: (order: unknown) => SelectQuery;
  limit: (count: number) => Promise<unknown[]>;
  then: (
    onFulfilled?: ((value: unknown) => unknown) | null,
    onRejected?: ((reason: unknown) => unknown) | null,
  ) => Promise<unknown>;
};

type UpdateChain = {
  set: (values: Record<string, unknown>) => UpdateChain;
  where: (condition: unknown) => UpdateChain;
  returning: (selection: Record<string, unknown>) => Promise<unknown[]>;
};

function createMemoryDatabase({
  selectedRows = [],
  updateResults = [],
}: {
  selectedRows?: unknown[][];
  updateResults?: unknown[][];
} = {}) {
  const selects: Array<{ table?: unknown; condition?: unknown }> = [];
  const updates: Array<{ table?: unknown; values?: Record<string, unknown>; condition?: unknown }> = [];
  let transactionCount = 0;

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
      limit: async () => selectedRows.shift() ?? [],
      then: (onFulfilled, onRejected) => {
        const result = selectedRows.shift() ?? [];
        return Promise.resolve(result).then(onFulfilled, onRejected);
      },
    };
    return query;
  };

  const tx = {
    select: buildSelectQuery,
    update: (table: unknown) => {
      const record: { table?: unknown; values?: Record<string, unknown>; condition?: unknown } = { table };
      updates.push(record);
      const chain: UpdateChain = {
        set: (values) => {
          record.values = values;
          return chain;
        },
        where: (condition) => {
          record.condition = condition;
          return chain;
        },
        returning: async () => updateResults.shift() ?? [],
      };
      return chain;
    },
  };

  return {
    database: {
      select: buildSelectQuery,
      transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => {
        transactionCount++;
        return callback(tx);
      },
    } as never,
    selects,
    updates,
    get transactionCount() {
      return transactionCount;
    },
  };
}

test("listPendingUniversitiesForApproval returns verified pending universities", async () => {
  const now = new Date("2026-10-31T20:00:00.000Z");
  const fakeRows = [
    {
      universityId: "univ-1",
      name: "Université Nazi Boni",
      acronym: "UNB",
      createdAt: now,
      adminEmail: "admin@unb.bf",
      adminName: "Admin UNB",
    },
  ];
  const fake = createMemoryDatabase({ selectedRows: [fakeRows] });
  const result = await listPendingUniversitiesForApproval(fake.database);

  assert.equal(result.length, 1);
  assert.equal(result[0].universityId, "univ-1");
  assert.equal(result[0].name, "Université Nazi Boni");
  assert.equal(result[0].acronym, "UNB");
  assert.equal(result[0].adminEmail, "admin@unb.bf");
});

test("approveUniversity rejects invalid revenueShareBps: -1, 10001, 12.5", async () => {
  const fake = createMemoryDatabase();

  const resNeg = await approveUniversity(
    { universityId: "u1", revenueShareBps: -1 },
    fake.database,
  );
  assert.deepEqual(resNeg, { ok: false, reason: "invalid_input" });

  const resOver = await approveUniversity(
    { universityId: "u1", revenueShareBps: 10001 },
    fake.database,
  );
  assert.deepEqual(resOver, { ok: false, reason: "invalid_input" });

  const resFloat = await approveUniversity(
    { universityId: "u1", revenueShareBps: 12.5 },
    fake.database,
  );
  assert.deepEqual(resFloat, { ok: false, reason: "invalid_input" });

  assert.equal(fake.transactionCount, 0);
});

test("approveUniversity returns not_found if university does not exist", async () => {
  const fake = createMemoryDatabase({
    selectedRows: [[]], // university not found
  });

  const res = await approveUniversity(
    { universityId: "u1", revenueShareBps: 2000 },
    fake.database,
  );
  assert.deepEqual(res, { ok: false, reason: "not_found" });
  assert.equal(fake.transactionCount, 1);
});

test("approveUniversity returns not_pending if university is already active or approved", async () => {
  const fake = createMemoryDatabase({
    selectedRows: [[{ id: "u1", name: "Univ Active", status: "active" }]],
  });

  const res = await approveUniversity(
    { universityId: "u1", revenueShareBps: 2000 },
    fake.database,
  );
  assert.deepEqual(res, { ok: false, reason: "not_pending" });
});

test("approveUniversity returns email_not_verified if no verified admin exists", async () => {
  const fake = createMemoryDatabase({
    selectedRows: [
      [{ id: "u1", name: "Univ En Attente", status: "pending" }],
      [], // no verified admin
    ],
  });

  const res = await approveUniversity(
    { universityId: "u1", revenueShareBps: 2000 },
    fake.database,
  );
  assert.deepEqual(res, { ok: false, reason: "email_not_verified" });
});

test("approveUniversity succeeds and returns university name and recipient emails", async () => {
  const fake = createMemoryDatabase({
    selectedRows: [
      [{ id: "u1", name: "Univ En Attente", status: "pending" }],
      [{ email: "admin@univ.bf" }],
    ],
    updateResults: [[{ id: "u1" }]],
  });

  const res = await approveUniversity(
    { universityId: "u1", revenueShareBps: 2500 },
    fake.database,
  );

  assert.deepEqual(res, {
    ok: true,
    universityName: "Univ En Attente",
    recipientEmails: ["admin@univ.bf"],
  });
  assert.equal(fake.updates.length, 1);
  assert.deepEqual(fake.updates[0].values, {
    status: "approved",
    revenueShareBps: 2500,
  });
});

test("approveUniversity returns not_pending on race condition when update returns 0 rows", async () => {
  const fake = createMemoryDatabase({
    selectedRows: [
      [{ id: "u1", name: "Univ En Attente", status: "pending" }],
      [{ email: "admin@univ.bf" }],
    ],
    updateResults: [[]], // course: 0 rows updated
  });

  const res = await approveUniversity(
    { universityId: "u1", revenueShareBps: 2500 },
    fake.database,
  );

  assert.deepEqual(res, { ok: false, reason: "not_pending" });
});
