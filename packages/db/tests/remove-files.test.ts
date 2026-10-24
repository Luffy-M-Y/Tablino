import assert from "node:assert/strict";
import test from "node:test";
import * as schema from "../src/schema";
import { deleteAssignment, deleteResource } from "../src/remove-files";

type DeleteRecord = {
  table: unknown;
  condition?: unknown;
};

type SelectQuery = {
  from: (table: unknown) => SelectQuery;
  where: (condition: unknown) => SelectQuery;
  for: (mode: "update") => SelectQuery;
  limit: (count: number) => Promise<unknown[]>;
};

type DeleteChain = {
  where: (condition: unknown) => Promise<void>;
};

function createMemoryDatabase(selectedRows: unknown[]) {
  const deletes: DeleteRecord[] = [];
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
    delete: (table: unknown) => {
      const deleteChain: DeleteChain = {
        where: async (condition: unknown) => {
          deletes.push({ table, condition });
        },
      };
      return deleteChain;
    },
  };

  return {
    database: {
      transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx),
    } as never,
    deletes,
    selectedTables,
    lockModes,
  };
}

const UNIVERSITY_ID = "university-a";
const RESOURCE_ID = "resource-a";
const ASSIGNMENT_ID = "assignment-a";

test("deleteResource deletes an existing resource after locking it", async () => {
  const fake = createMemoryDatabase([{ id: RESOURCE_ID }]);

  assert.deepEqual(
    await deleteResource(UNIVERSITY_ID, RESOURCE_ID, fake.database),
    { ok: true },
  );
  assert.deepEqual(fake.selectedTables, [schema.resources]);
  assert.deepEqual(fake.lockModes, ["update"]);
  assert.equal(fake.deletes.length, 1);
  assert.equal(fake.deletes[0].table, schema.resources);
});

test("deleteResource returns not_found without deleting", async () => {
  const fake = createMemoryDatabase([]);

  assert.deepEqual(
    await deleteResource(UNIVERSITY_ID, RESOURCE_ID, fake.database),
    { ok: false, reason: "not_found" },
  );
  assert.deepEqual(fake.selectedTables, [schema.resources]);
  assert.deepEqual(fake.lockModes, ["update"]);
  assert.deepEqual(fake.deletes, []);
});

test("deleteAssignment deletes an existing assignment after locking it", async () => {
  const fake = createMemoryDatabase([{ id: ASSIGNMENT_ID }]);

  assert.deepEqual(
    await deleteAssignment(UNIVERSITY_ID, ASSIGNMENT_ID, fake.database),
    { ok: true },
  );
  assert.deepEqual(fake.selectedTables, [schema.assignments]);
  assert.deepEqual(fake.lockModes, ["update"]);
  assert.equal(fake.deletes.length, 1);
  assert.equal(fake.deletes[0].table, schema.assignments);
});

test("deleteAssignment returns not_found without deleting", async () => {
  const fake = createMemoryDatabase([]);

  assert.deepEqual(
    await deleteAssignment(UNIVERSITY_ID, ASSIGNMENT_ID, fake.database),
    { ok: false, reason: "not_found" },
  );
  assert.deepEqual(fake.selectedTables, [schema.assignments]);
  assert.deepEqual(fake.lockModes, ["update"]);
  assert.deepEqual(fake.deletes, []);
});
