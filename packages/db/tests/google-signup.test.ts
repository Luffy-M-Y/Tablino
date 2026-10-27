import assert from "node:assert/strict";
import test from "node:test";
import { registerGoogleStudentWithCode } from "../src/google-signup";
import * as schema from "../src/schema";

type SelectQuery = {
  from: (table: unknown) => SelectQuery;
  where: (condition: unknown) => SelectQuery;
  limit: (count: number) => Promise<unknown[]>;
};

type UpdateRecord = {
  table: unknown;
  values?: Record<string, unknown>;
  condition?: unknown;
  returning?: Record<string, unknown>;
};

type UpdateChain = {
  set: (values: Record<string, unknown>) => UpdateChain;
  where: (condition: unknown) => UpdateChain;
  returning: (selection: Record<string, unknown>) => Promise<unknown[]>;
};

type InsertRecord = {
  table: unknown;
  values?: Record<string, unknown>;
};

type InsertChain = {
  values: (values: Record<string, unknown>) => InsertChain;
  returning: (selection: Record<string, unknown>) => Promise<unknown[]>;
  then: (
    onFulfilled?: ((value: unknown) => unknown) | null,
    onRejected?: ((reason: unknown) => unknown) | null,
  ) => Promise<unknown>;
};

function createMemoryDatabase({
  selectedRows = [],
  updateResults = [],
  insertResults = [],
}: {
  selectedRows?: unknown[][];
  updateResults?: unknown[][];
  insertResults?: Array<unknown[] | Error>;
} = {}) {
  const selects: Array<{ table?: unknown; condition?: unknown }> = [];
  const updates: UpdateRecord[] = [];
  const inserts: InsertRecord[] = [];
  let transactionCount = 0;

  const tx = {
    select: () => {
      const record: { table?: unknown; condition?: unknown } = {};
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
        limit: async () => selectedRows.shift() ?? [],
      };
      return query;
    },
    update: (table: unknown) => {
      const record: UpdateRecord = { table };
      const chain: UpdateChain = {
        set: (values) => {
          record.values = values;
          return chain;
        },
        where: (condition) => {
          record.condition = condition;
          return chain;
        },
        returning: async (selection) => {
          record.returning = selection;
          updates.push(record);
          return updateResults.shift() ?? [];
        },
      };
      return chain;
    },
    insert: (table: unknown) => {
      const record: InsertRecord = { table };
      inserts.push(record);
      const chain: InsertChain = {
        values: (values) => {
          record.values = values;
          return chain;
        },
        returning: async () => {
          const result = insertResults.shift() ?? [];
          if (result instanceof Error) throw result;
          return result;
        },
        then: (onFulfilled, onRejected) => {
          const result = insertResults.shift() ?? [];
          if (result instanceof Error) {
            return Promise.reject(result).then(onFulfilled, onRejected);
          }
          return Promise.resolve(result).then(onFulfilled, onRejected);
        },
      };
      return chain;
    },
  };

  return {
    database: {
      transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => {
        transactionCount++;
        return callback(tx);
      },
    } as never,
    selects,
    updates,
    inserts,
    get transactionCount() {
      return transactionCount;
    },
  };
}

const validInput = {
  email: " STUDENT@EXAMPLE.COM ",
  name: " Ada Lovelace ",
  image: " https://example.com/avatar.png ",
  providerAccountId: " google-account-id ",
  accessCode: "ABCD-EFGH-JKLM",
};

test("registerGoogleStudentWithCode rejects invalid input before opening a transaction", async () => {
  for (const input of [
    { ...validInput, email: "invalid-email" },
    { ...validInput, providerAccountId: "   " },
    { ...validInput, accessCode: "invalid" },
  ]) {
    const fake = createMemoryDatabase();

    assert.deepEqual(
      await registerGoogleStudentWithCode("university-id", input, fake.database),
      { ok: false, reason: "invalid_input" },
    );
    assert.equal(fake.transactionCount, 0);
  }
});

test("registerGoogleStudentWithCode rejects an existing email", async () => {
  const fake = createMemoryDatabase({ selectedRows: [[{ id: "existing-user" }]] });

  assert.deepEqual(
    await registerGoogleStudentWithCode("university-id", validInput, fake.database),
    { ok: false, reason: "email_taken" },
  );
  assert.deepEqual(fake.updates, []);
  assert.deepEqual(fake.inserts, []);
});

test("registerGoogleStudentWithCode rejects an existing Google account", async () => {
  const fake = createMemoryDatabase({
    selectedRows: [[], [{ userId: "existing-user" }]],
  });

  assert.deepEqual(
    await registerGoogleStudentWithCode("university-id", validInput, fake.database),
    { ok: false, reason: "account_taken" },
  );
  assert.deepEqual(fake.updates, []);
  assert.deepEqual(fake.inserts, []);
});

test("registerGoogleStudentWithCode rejects an unavailable code", async () => {
  const fake = createMemoryDatabase({
    selectedRows: [[], []],
    updateResults: [[]],
  });

  assert.deepEqual(
    await registerGoogleStudentWithCode("university-id", validInput, fake.database),
    { ok: false, reason: "invalid_code" },
  );
  assert.equal(fake.updates.length, 1);
  assert.deepEqual(fake.inserts, []);
});

test("registerGoogleStudentWithCode consumes a code and creates a Google student", async () => {
  const now = new Date("2026-10-26T12:00:00.000Z");
  const fake = createMemoryDatabase({
    selectedRows: [[], []],
    updateResults: [[{ id: "access-code-id" }]],
    insertResults: [[{ id: "user-id" }], []],
  });

  const result = await registerGoogleStudentWithCode(
    "university-id",
    validInput,
    fake.database,
    now,
  );

  assert.deepEqual(result, { ok: true, userId: "user-id" });
  assert.equal(fake.transactionCount, 1);
  assert.equal(fake.updates.length, 1);
  assert.equal(fake.updates[0].table, schema.accessCodes);
  assert.equal(fake.inserts.length, 2);
  assert.equal(fake.inserts[0].table, schema.users);
  assert.equal(fake.inserts[0].values?.name, "Ada Lovelace");
  assert.equal(fake.inserts[0].values?.email, "student@example.com");
  assert.equal(fake.inserts[0].values?.image, "https://example.com/avatar.png");
  assert.equal(fake.inserts[0].values?.role, "student");
  assert.equal(fake.inserts[0].values?.universityId, "university-id");
  assert.equal(fake.inserts[0].values?.accessCodeId, "access-code-id");
  assert.equal(fake.inserts[0].values?.emailVerified, now);
  assert.equal(Object.hasOwn(fake.inserts[0].values ?? {}, "passwordHash"), false);
  assert.equal(fake.inserts[1].table, schema.accounts);
  assert.deepEqual(fake.inserts[1].values, {
    userId: "user-id",
    type: "oauth",
    provider: "google",
    providerAccountId: "google-account-id",
  });
});

test("registerGoogleStudentWithCode maps a unique constraint violation to email_taken", async () => {
  const uniqueError = Object.assign(new Error("unique constraint"), { code: "23505" });
  const fake = createMemoryDatabase({
    selectedRows: [[], []],
    updateResults: [[{ id: "access-code-id" }]],
    insertResults: [[{ id: "user-id" }], uniqueError],
  });

  assert.deepEqual(
    await registerGoogleStudentWithCode("university-id", validInput, fake.database),
    { ok: false, reason: "email_taken" },
  );
  assert.equal(fake.updates.length, 1);
  assert.equal(fake.inserts.length, 2);
});
