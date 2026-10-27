import assert from "node:assert/strict";
import test from "node:test";
import {
  EMAIL_CODE_RESEND_DELAY_MS,
  generateEmailVerificationCode,
  hashEmailVerificationCode,
  issueEmailVerificationCode,
  verifyEmailCode,
} from "../src/email-verification";
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
  then: (
    onFulfilled?: ((value: unknown) => unknown) | null,
    onRejected?: ((reason: unknown) => unknown) | null,
  ) => Promise<unknown>;
};

type InsertRecord = {
  table: unknown;
  values?: Record<string, unknown>;
};

type InsertChain = {
  values: (values: Record<string, unknown>) => InsertChain;
  then: (
    onFulfilled?: ((value: unknown) => unknown) | null,
    onRejected?: ((reason: unknown) => unknown) | null,
  ) => Promise<unknown>;
};

function createMemoryDatabase({
  selectedRows = [],
  updateResults = [],
  insertErrors = [],
}: {
  selectedRows?: unknown[][];
  updateResults?: unknown[][];
  insertErrors?: Error[];
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
          updates.push(record);
          return chain;
        },
        returning: async (selection) => {
          record.returning = selection;
          return updateResults.shift() ?? [];
        },
        then: (onFulfilled, onRejected) => Promise.resolve(undefined).then(onFulfilled, onRejected),
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
        then: (onFulfilled, onRejected) => {
          const error = insertErrors.shift();
          return error
            ? Promise.reject(error).then(onFulfilled, onRejected)
            : Promise.resolve(undefined).then(onFulfilled, onRejected);
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

const userId = "student-id";
const now = new Date("2026-10-27T10:00:00.000Z");

test("generateEmailVerificationCode returns six digits", () => {
  const code = generateEmailVerificationCode();

  assert.equal(code.length, 6);
  assert.equal(Array.from(code).every((character) => character >= "0" && character <= "9"), true);
});

test("hashEmailVerificationCode is deterministic and user-specific", () => {
  assert.equal(
    hashEmailVerificationCode(userId, "012345"),
    hashEmailVerificationCode(userId, "012345"),
  );
  assert.notEqual(
    hashEmailVerificationCode(userId, "012345"),
    hashEmailVerificationCode("another-user", "012345"),
  );
});

test("issueEmailVerificationCode rejects a missing user", async () => {
  const fake = createMemoryDatabase({ selectedRows: [[]] });

  assert.deepEqual(await issueEmailVerificationCode(userId, now, fake.database), {
    ok: false,
    reason: "not_found",
  });
  assert.equal(fake.transactionCount, 1);
});

test("issueEmailVerificationCode rejects an already verified user", async () => {
  const fake = createMemoryDatabase({ selectedRows: [[{ emailVerified: now }]] });

  assert.deepEqual(await issueEmailVerificationCode(userId, now, fake.database), {
    ok: false,
    reason: "already_verified",
  });
});

test("issueEmailVerificationCode enforces the resend delay", async () => {
  const fake = createMemoryDatabase({
    selectedRows: [
      [{ emailVerified: null }],
      [{ id: "verification-id", sentAt: new Date(now.getTime() - EMAIL_CODE_RESEND_DELAY_MS + 1) }],
    ],
  });

  assert.deepEqual(await issueEmailVerificationCode(userId, now, fake.database), {
    ok: false,
    reason: "too_soon",
  });
  assert.deepEqual(fake.updates, []);
  assert.deepEqual(fake.inserts, []);
});

test("issueEmailVerificationCode inserts a new code", async () => {
  const fake = createMemoryDatabase({
    selectedRows: [[{ emailVerified: null }], []],
  });

  const result = await issueEmailVerificationCode(userId, now, fake.database);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.code.length, 6);
  assert.equal(fake.inserts.length, 1);
  assert.equal(fake.inserts[0].table, schema.emailVerificationCodes);
  assert.equal(fake.inserts[0].values?.userId, userId);
  assert.equal(fake.inserts[0].values?.codeHash, hashEmailVerificationCode(userId, result.code));
  assert.equal(fake.inserts[0].values?.attempts, 0);
  assert.equal(fake.inserts[0].values?.sentAt, now);
  assert.equal(fake.inserts[0].values?.consumedAt, null);
});

test("issueEmailVerificationCode maps a unique conflict to too_soon", async () => {
  const uniqueError = Object.assign(new Error("unique constraint"), { code: "23505" });
  const fake = createMemoryDatabase({
    selectedRows: [[{ emailVerified: null }], []],
    insertErrors: [uniqueError],
  });

  assert.deepEqual(await issueEmailVerificationCode(userId, now, fake.database), {
    ok: false,
    reason: "too_soon",
  });
});

test("issueEmailVerificationCode replaces an existing code", async () => {
  const fake = createMemoryDatabase({
    selectedRows: [
      [{ emailVerified: null }],
      [{ id: "verification-id", sentAt: new Date(now.getTime() - EMAIL_CODE_RESEND_DELAY_MS) }],
    ],
  });

  const result = await issueEmailVerificationCode(userId, now, fake.database);

  assert.equal(result.ok, true);
  assert.equal(fake.updates.length, 1);
  assert.equal(fake.updates[0].table, schema.emailVerificationCodes);
  assert.equal(fake.updates[0].values?.attempts, 0);
  assert.equal(fake.updates[0].values?.expiresAt instanceof Date, true);
  assert.equal(fake.updates[0].values?.sentAt, now);
  assert.equal(fake.updates[0].values?.consumedAt, null);
  assert.deepEqual(fake.inserts, []);
});

test("verifyEmailCode rejects malformed input before opening a transaction", async () => {
  for (const code of ["", "12345", "1234567", "12a456"]) {
    const fake = createMemoryDatabase();

    assert.deepEqual(await verifyEmailCode(userId, code, now, fake.database), {
      ok: false,
      reason: "invalid_input",
    });
    assert.equal(fake.transactionCount, 0);
  }
});

test("verifyEmailCode rejects an unavailable code", async () => {
  const fake = createMemoryDatabase({ updateResults: [[]] });

  assert.deepEqual(await verifyEmailCode(userId, "012345", now, fake.database), {
    ok: false,
    reason: "code_unavailable",
  });
  assert.equal(fake.updates.length, 1);
});

test("verifyEmailCode records an invalid attempt without updating the user", async () => {
  const fake = createMemoryDatabase({
    updateResults: [[{ codeHash: hashEmailVerificationCode(userId, "999999") }]],
  });

  assert.deepEqual(await verifyEmailCode(userId, "012345", now, fake.database), {
    ok: false,
    reason: "invalid_code",
  });
  assert.equal(fake.updates.length, 1);
  assert.equal(fake.updates[0].table, schema.emailVerificationCodes);
  assert.deepEqual(fake.inserts, []);
});

test("verifyEmailCode consumes a valid code and verifies the user", async () => {
  const fake = createMemoryDatabase({
    updateResults: [[{ codeHash: hashEmailVerificationCode(userId, "012345") }]],
  });

  assert.deepEqual(await verifyEmailCode(userId, " 012345 ", now, fake.database), { ok: true });
  assert.equal(fake.updates.length, 3);
  assert.equal(fake.updates[0].table, schema.emailVerificationCodes);
  assert.notEqual(fake.updates[0].values?.attempts, undefined);
  assert.equal(fake.updates[1].table, schema.emailVerificationCodes);
  assert.equal(fake.updates[1].values?.consumedAt, now);
  assert.equal(fake.updates[2].table, schema.users);
  assert.equal(fake.updates[2].values?.emailVerified, now);
});
