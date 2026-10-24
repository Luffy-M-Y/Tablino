import assert from "node:assert/strict";
import test from "node:test";
import * as schema from "../src/schema";
import { publishAssignment, publishResource } from "../src/publish";

type UpdateRecord = {
  table: unknown;
  values?: Record<string, unknown>;
};

type SelectQuery = {
  from: (table: unknown) => SelectQuery;
  where: (condition: unknown) => SelectQuery;
  for: (mode: "update") => SelectQuery;
  limit: (count: number) => Promise<unknown[]>;
};

type UpdateChain = {
  set: (values: Record<string, unknown>) => UpdateChain;
  where: (condition: unknown) => UpdateChain;
  returning: () => Promise<unknown[]>;
};

function createMemoryDatabase(selectedRows: unknown[], updatedRows: unknown[]) {
  const updates: UpdateRecord[] = [];
  const selectedTables: unknown[] = [];
  const lockModes: string[] = [];

  const tx = {
    select: () => {
      const query: SelectQuery = {
        from: (table) => {
          selectedTables.push(table);
          return query;
        },
        where: () => query,
        for: (mode) => {
          lockModes.push(mode);
          return query;
        },
        limit: async () => selectedRows,
      };
      return query;
    },
    update: (table: unknown) => {
      const updateChain: UpdateChain = {
        set: (values) => {
          updates.push({ table, values });
          return updateChain;
        },
        where: () => updateChain,
        returning: async () => updatedRows,
      };
      return updateChain;
    },
  };

  return {
    database: {
      transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx),
    } as never,
    updates,
    selectedTables,
    lockModes,
  };
}

const UNIVERSITY_ID = "university-a";
const RESOURCE_ID = "resource-a";
const ASSIGNMENT_ID = "assignment-a";

test("publishResource publishes a draft resource", async () => {
  const fake = createMemoryDatabase(
    [{ id: RESOURCE_ID, status: "draft" }],
    [{ id: RESOURCE_ID }],
  );

  assert.deepEqual(
    await publishResource(UNIVERSITY_ID, RESOURCE_ID, fake.database),
    { ok: true },
  );
  assert.deepEqual(fake.selectedTables, [schema.resources]);
  assert.deepEqual(fake.lockModes, ["update"]);
  assert.equal(fake.updates.length, 1);
  assert.equal(fake.updates[0]?.table, schema.resources);
  assert.equal(fake.updates[0]?.values?.status, "published");
  assert.ok(fake.updates[0]?.values?.publishedAt instanceof Date);
});

test("publishResource rejects a missing resource without updating", async () => {
  const fake = createMemoryDatabase([], []);

  assert.deepEqual(
    await publishResource(UNIVERSITY_ID, RESOURCE_ID, fake.database),
    { ok: false, reason: "not_found" },
  );
  assert.deepEqual(fake.selectedTables, [schema.resources]);
  assert.deepEqual(fake.lockModes, ["update"]);
  assert.deepEqual(fake.updates, []);
});

test("publishResource does not update an already published resource", async () => {
  const fake = createMemoryDatabase(
    [{ id: RESOURCE_ID, status: "published" }],
    [],
  );

  assert.deepEqual(
    await publishResource(UNIVERSITY_ID, RESOURCE_ID, fake.database),
    { ok: true },
  );
  assert.deepEqual(fake.selectedTables, [schema.resources]);
  assert.deepEqual(fake.lockModes, ["update"]);
  assert.deepEqual(fake.updates, []);
});

test("publishAssignment publishes a draft assignment", async () => {
  const fake = createMemoryDatabase(
    [{ id: ASSIGNMENT_ID, status: "draft" }],
    [{ id: ASSIGNMENT_ID }],
  );

  assert.deepEqual(
    await publishAssignment(UNIVERSITY_ID, ASSIGNMENT_ID, fake.database),
    { ok: true },
  );
  assert.deepEqual(fake.selectedTables, [schema.assignments]);
  assert.deepEqual(fake.lockModes, ["update"]);
  assert.equal(fake.updates.length, 1);
  assert.equal(fake.updates[0]?.table, schema.assignments);
  assert.equal(fake.updates[0]?.values?.status, "published");
});
