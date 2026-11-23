import assert from "node:assert/strict";
import test from "node:test";
import { setUniversityVisibility } from "../src/university-visibility";
import * as schema from "../src/schema";

type SelectQuery = {
  from: (table: unknown) => SelectQuery;
  where: (condition: unknown) => SelectQuery;
  for: (lock: "update") => SelectQuery;
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
  const selects: Array<{ table?: unknown; condition?: unknown; lock?: "update" }> = [];
  const updates: Array<{ table?: unknown; values?: Record<string, unknown>; condition?: unknown }> = [];
  const committedUpdates: typeof updates = [];
  let transactionCount = 0;

  const buildSelectQuery = (): SelectQuery => {
    const record: { table?: unknown; condition?: unknown; lock?: "update" } = {};
    selects.push(record);
    const query: SelectQuery = {
      from: (table) => {
        record.table = table;
        return query;
      },
      where: (condition) => {
        record.condition = condition;
        return query;
      },
      for: (lock) => {
        record.lock = lock;
        return query;
      },
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
        const updateStart = updates.length;
        const result = await callback(tx);
        committedUpdates.push(...updates.slice(updateStart));
        return result;
      },
    } as never,
    selects,
    updates,
    committedUpdates,
    get transactionCount() {
      return transactionCount;
    },
  };
}

const validInput = {
  userId: "user-admin",
  universityId: "u-1",
  visibility: "private" as const,
};

test("setUniversityVisibility rejects invalid input without opening a transaction", async () => {
  const fake = createMemoryDatabase();

  const invalidInputs = [
    { ...validInput, userId: "   " },
    { ...validInput, universityId: 42 as never },
    { ...validInput, visibility: "hidden" as never },
  ];

  for (const input of invalidInputs) {
    const res = await setUniversityVisibility(input, fake.database);
    assert.deepEqual(res, { ok: false, reason: "invalid_input" });
  }

  const nullResult = await setUniversityVisibility(null as never, fake.database);
  assert.deepEqual(nullResult, { ok: false, reason: "invalid_input" });

  assert.equal(fake.transactionCount, 0);
  assert.equal(fake.selects.length, 0);
  assert.equal(fake.updates.length, 0);
});

test("setUniversityVisibility rejects a requester who is not an active university admin", async () => {
  const fake = createMemoryDatabase({
    selectedRows: [[]],
  });

  const res = await setUniversityVisibility(validInput, fake.database);

  assert.deepEqual(res, { ok: false, reason: "not_authorized" });
  assert.equal(fake.transactionCount, 1);
  assert.equal(fake.updates.length, 0);
});

test("setUniversityVisibility rejects an unknown university", async () => {
  const fake = createMemoryDatabase({
    selectedRows: [[{ id: "user-admin" }], []],
  });

  const res = await setUniversityVisibility(validInput, fake.database);

  assert.deepEqual(res, { ok: false, reason: "not_active" });
  assert.equal(fake.updates.length, 0);
});

test("setUniversityVisibility rejects a university that is not active", async () => {
  const fake = createMemoryDatabase({
    selectedRows: [
      [{ id: "user-admin" }],
      [{ id: "u-1", status: "approved", visibility: "public" }],
    ],
  });

  const res = await setUniversityVisibility(
    { ...validInput, visibility: "public" },
    fake.database,
  );

  assert.deepEqual(res, { ok: false, reason: "not_active" });
  assert.equal(fake.updates.length, 0);
});

test("setUniversityVisibility returns early when the visibility is unchanged", async () => {
  const fake = createMemoryDatabase({
    selectedRows: [
      [{ id: "user-admin" }],
      [{ id: "u-1", status: "active", visibility: "public" }],
    ],
  });

  const res = await setUniversityVisibility(
    { ...validInput, visibility: "public" },
    fake.database,
  );

  assert.deepEqual(res, { ok: true, visibility: "public", revokedCodes: 0 });
  assert.equal(fake.updates.length, 0);
  assert.equal(fake.committedUpdates.length, 0);
});

test("setUniversityVisibility switches to private and revokes every active code", async () => {
  const now = new Date("2026-11-23T12:00:00.000Z");
  const fake = createMemoryDatabase({
    selectedRows: [
      [{ id: "user-admin" }],
      [{ id: "u-1", status: "active", visibility: "public" }],
    ],
    updateResults: [[{ id: "code-1" }, { id: "code-2" }, { id: "code-3" }]],
  });

  const res = await setUniversityVisibility(
    { ...validInput, visibility: "private" },
    fake.database,
    now,
  );

  assert.deepEqual(res, { ok: true, visibility: "private", revokedCodes: 3 });
  assert.equal(fake.transactionCount, 1);
  assert.equal(fake.updates.length, 2);
  assert.equal(fake.updates[0].table, schema.universities);
  assert.deepEqual(fake.updates[0].values, { visibility: "private" });
  assert.equal(fake.updates[1].table, schema.accessCodes);
  assert.deepEqual(fake.updates[1].values, { revokedAt: now });
  assert.deepEqual(fake.committedUpdates, fake.updates);
});

test("setUniversityVisibility switches to private with zero active codes", async () => {
  const now = new Date("2026-11-23T12:00:00.000Z");
  const fake = createMemoryDatabase({
    selectedRows: [
      [{ id: "user-admin" }],
      [{ id: "u-1", status: "active", visibility: "public" }],
    ],
    updateResults: [[]],
  });

  const res = await setUniversityVisibility(
    { ...validInput, visibility: "private" },
    fake.database,
    now,
  );

  assert.deepEqual(res, { ok: true, visibility: "private", revokedCodes: 0 });
  assert.equal(fake.updates.length, 2);
  assert.equal(fake.updates[0].table, schema.universities);
  assert.deepEqual(fake.updates[0].values, { visibility: "private" });
  assert.equal(fake.updates[1].table, schema.accessCodes);
  assert.deepEqual(fake.updates[1].values, { revokedAt: now });
});

test("setUniversityVisibility switches to public without touching access codes", async () => {
  const fake = createMemoryDatabase({
    selectedRows: [
      [{ id: "user-admin" }],
      [{ id: "u-1", status: "active", visibility: "private" }],
    ],
  });

  const res = await setUniversityVisibility(
    { ...validInput, visibility: "public" },
    fake.database,
  );

  assert.deepEqual(res, { ok: true, visibility: "public", revokedCodes: 0 });
  assert.equal(fake.updates.length, 1);
  assert.equal(fake.updates[0].table, schema.universities);
  assert.deepEqual(fake.updates[0].values, { visibility: "public" });
});
