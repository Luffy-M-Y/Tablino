import assert from "node:assert/strict";
import test from "node:test";
import { markGoogleEmailVerified } from "../src/google-link";
import * as schema from "../src/schema";

type SelectQuery = {
  from: (table: unknown) => SelectQuery;
  where: (condition: unknown) => SelectQuery;
  for: (lock: "update") => SelectQuery;
  limit: (count: number) => Promise<unknown[]>;
};

type MutationRecord = {
  table: unknown;
  values?: Record<string, unknown>;
};

function createMemoryDatabase(selectedRows: unknown[][] = []) {
  const selectedTables: unknown[] = [];
  const updates: MutationRecord[] = [];
  const deletes: MutationRecord[] = [];
  let transactionCount = 0;

  const transactionDatabase = {
    select: () => {
      const query: SelectQuery = {
        from: (table) => {
          selectedTables.push(table);
          return query;
        },
        where: () => query,
        for: () => query,
        limit: async () => selectedRows.shift() ?? [],
      };
      return query;
    },
    update: (table: unknown) => ({
      set: (values: Record<string, unknown>) => ({
        where: async () => {
          updates.push({ table, values });
        },
      }),
    }),
    delete: (table: unknown) => ({
      where: async () => {
        deletes.push({ table });
      },
    }),
  };

  const database = {
    transaction: async (callback: (tx: typeof transactionDatabase) => Promise<unknown>) => {
      transactionCount++;
      return callback(transactionDatabase);
    },
  };

  return {
    database: database as never,
    selectedTables,
    updates,
    deletes,
    get transactionCount() { return transactionCount; },
  };
}

const userId = "student-id";
const now = new Date("2026-10-26T12:00:00.000Z");

function userRow(overrides: Record<string, unknown> = {}) {
  return {
    id: userId,
    emailVerified: null,
    passwordHash: "stored-password-hash",
    ...overrides,
  };
}

test("markGoogleEmailVerified returns not found without writes for an absent user", async () => {
  const fake = createMemoryDatabase([[]]);

  assert.deepEqual(
    await markGoogleEmailVerified(userId, now, fake.database),
    { found: false, passwordRemoved: false },
  );
  assert.deepEqual(fake.selectedTables, [schema.users]);
  assert.equal(fake.updates.length, 0);
  assert.equal(fake.deletes.length, 0);
  assert.equal(fake.transactionCount, 1);
});

test("markGoogleEmailVerified leaves a verified user's password untouched", async () => {
  const verifiedAt = new Date("2026-10-25T12:00:00.000Z");
  const fake = createMemoryDatabase([[userRow({ emailVerified: verifiedAt })]]);

  assert.deepEqual(
    await markGoogleEmailVerified(userId, now, fake.database),
    { found: true, passwordRemoved: false },
  );
  assert.equal(fake.updates.length, 0);
  assert.equal(fake.deletes.length, 0);
});

test("markGoogleEmailVerified removes the password and sessions for an unverified user", async () => {
  const fake = createMemoryDatabase([[userRow()]]);

  assert.deepEqual(
    await markGoogleEmailVerified(userId, now, fake.database),
    { found: true, passwordRemoved: true },
  );
  assert.deepEqual(fake.updates, [{
    table: schema.users,
    values: { emailVerified: now, passwordHash: null },
  }]);
  assert.deepEqual(fake.deletes, [{ table: schema.sessions }]);
});

test("markGoogleEmailVerified verifies an unverified user without a password", async () => {
  const fake = createMemoryDatabase([[userRow({ passwordHash: null })]]);

  assert.deepEqual(
    await markGoogleEmailVerified(userId, now, fake.database),
    { found: true, passwordRemoved: false },
  );
  assert.deepEqual(fake.updates, [{
    table: schema.users,
    values: { emailVerified: now, passwordHash: null },
  }]);
  assert.deepEqual(fake.deletes, [{ table: schema.sessions }]);
});
