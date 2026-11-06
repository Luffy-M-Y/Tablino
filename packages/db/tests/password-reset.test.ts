import assert from "node:assert/strict";
import test from "node:test";
import {
  PASSWORD_RESET_CODE_RESEND_DELAY_MS,
  PASSWORD_RESET_UNKNOWN_USER_ID,
  generatePasswordResetCode,
  hashPasswordResetCode,
  issuePasswordResetCode,
  requestPasswordReset,
  resendPasswordResetCode,
  setStudentPassword,
  verifyPasswordResetCode,
} from "../src/password-reset";
import { hashPassword } from "../src/password";
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

type InsertRecord = {
  table: unknown;
  values?: Record<string, unknown>;
};

type DeleteRecord = {
  table: unknown;
  condition?: unknown;
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

type InsertChain = {
  values: (values: Record<string, unknown>) => InsertChain;
  then: (
    onFulfilled?: ((value: unknown) => unknown) | null,
    onRejected?: ((reason: unknown) => unknown) | null,
  ) => Promise<unknown>;
};

type DeleteChain = {
  where: (condition: unknown) => DeleteChain;
  then: (
    onFulfilled?: ((value: unknown) => unknown) | null,
    onRejected?: ((reason: unknown) => unknown) | null,
  ) => Promise<unknown>;
};

function createMemoryDatabase({
  selectedRows = [],
  updateResults = [],
  insertErrors = [],
  executeRows = [],
}: {
  selectedRows?: unknown[][];
  updateResults?: unknown[][];
  insertErrors?: Error[];
  executeRows?: Array<Array<Record<string, unknown>>>;
} = {}) {
  const selects: Array<{ table?: unknown; condition?: unknown }> = [];
  const updates: UpdateRecord[] = [];
  const inserts: InsertRecord[] = [];
  const deletes: DeleteRecord[] = [];
  let transactionCount = 0;
  let executeCalls = 0;

  const selectBuilder = () => {
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
  };

  const executeFn = async () => {
    executeCalls++;
    return { rows: executeRows.shift() ?? [] };
  };

  const tx = {
    select: selectBuilder,
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
    delete: (table: unknown) => {
      const record: DeleteRecord = { table };
      deletes.push(record);
      const chain: DeleteChain = {
        where: (condition) => {
          record.condition = condition;
          return chain;
        },
        then: (onFulfilled, onRejected) => Promise.resolve(undefined).then(onFulfilled, onRejected),
      };
      return chain;
    },
    execute: executeFn,
  };

  return {
    database: {
      select: selectBuilder,
      execute: executeFn,
      transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => {
        transactionCount++;
        return callback(tx);
      },
    } as never,
    selects,
    updates,
    inserts,
    deletes,
    get transactionCount() {
      return transactionCount;
    },
    get executeCalls() {
      return executeCalls;
    },
  };
}

const userId = "student-id";
const now = new Date("2026-10-27T10:00:00.000Z");

test("generatePasswordResetCode returns six digits", () => {
  const code = generatePasswordResetCode();

  assert.equal(code.length, 6);
  assert.equal(Array.from(code).every((character) => character >= "0" && character <= "9"), true);
});

test("hashPasswordResetCode is deterministic and user-specific", () => {
  assert.equal(
    hashPasswordResetCode(userId, "012345"),
    hashPasswordResetCode(userId, "012345"),
  );
  assert.notEqual(
    hashPasswordResetCode(userId, "012345"),
    hashPasswordResetCode("another-user", "012345"),
  );
});

test("PASSWORD_RESET_UNKNOWN_USER_ID is the nil UUID", () => {
  assert.equal(PASSWORD_RESET_UNKNOWN_USER_ID, "00000000-0000-0000-0000-000000000000");
});

test("issuePasswordResetCode rejects a missing user", async () => {
  const fake = createMemoryDatabase({ selectedRows: [[]] });

  assert.deepEqual(await issuePasswordResetCode(userId, now, fake.database), {
    ok: false,
    reason: "not_found",
  });
  assert.equal(fake.transactionCount, 1);
});

test("issuePasswordResetCode rejects an unverified user", async () => {
  const fake = createMemoryDatabase({ selectedRows: [[{ emailVerified: null, passwordHash: "stored-hash", role: "student" }]] });

  assert.deepEqual(await issuePasswordResetCode(userId, now, fake.database), {
    ok: false,
    reason: "not_verified",
  });
  assert.deepEqual(fake.updates, []);
  assert.deepEqual(fake.inserts, []);
});

test("issuePasswordResetCode rejects a non-student account", async () => {
  const fake = createMemoryDatabase({
    selectedRows: [[{ emailVerified: now, passwordHash: "stored-hash", role: "university_admin" }]],
  });

  assert.deepEqual(await issuePasswordResetCode(userId, now, fake.database), {
    ok: false,
    reason: "not_student",
  });
  assert.deepEqual(fake.updates, []);
  assert.deepEqual(fake.inserts, []);
});

test("issuePasswordResetCode rejects an account without a password hash", async () => {
  const fake = createMemoryDatabase({
    selectedRows: [[{ emailVerified: now, passwordHash: null, role: "student" }]],
  });

  assert.deepEqual(await issuePasswordResetCode(userId, now, fake.database), {
    ok: false,
    reason: "no_password",
  });
  assert.deepEqual(fake.updates, []);
  assert.deepEqual(fake.inserts, []);
});

test("issuePasswordResetCode enforces the resend delay", async () => {
  const fake = createMemoryDatabase({
    selectedRows: [
      [{ emailVerified: now, passwordHash: "stored-hash", role: "student" }],
      [{ id: "reset-id", sentAt: new Date(now.getTime() - PASSWORD_RESET_CODE_RESEND_DELAY_MS + 1) }],
    ],
  });

  assert.deepEqual(await issuePasswordResetCode(userId, now, fake.database), {
    ok: false,
    reason: "too_soon",
  });
  assert.deepEqual(fake.updates, []);
  assert.deepEqual(fake.inserts, []);
});

test("issuePasswordResetCode inserts a new code", async () => {
  const fake = createMemoryDatabase({
    selectedRows: [[{ emailVerified: now, passwordHash: "stored-hash", role: "student" }], []],
  });

  const result = await issuePasswordResetCode(userId, now, fake.database);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.code.length, 6);
  assert.equal(fake.inserts.length, 1);
  assert.equal(fake.inserts[0].table, schema.passwordResetCodes);
  assert.equal(fake.inserts[0].values?.userId, userId);
  assert.equal(fake.inserts[0].values?.codeHash, hashPasswordResetCode(userId, result.code));
  assert.equal(fake.inserts[0].values?.attempts, 0);
  assert.equal(fake.inserts[0].values?.sentAt, now);
  assert.equal(fake.inserts[0].values?.consumedAt, null);
});

test("issuePasswordResetCode maps a unique conflict to too_soon", async () => {
  const uniqueError = Object.assign(new Error("unique constraint"), { code: "23505" });
  const fake = createMemoryDatabase({
    selectedRows: [[{ emailVerified: now, passwordHash: "stored-hash", role: "student" }], []],
    insertErrors: [uniqueError],
  });

  assert.deepEqual(await issuePasswordResetCode(userId, now, fake.database), {
    ok: false,
    reason: "too_soon",
  });
});

test("issuePasswordResetCode replaces an existing code", async () => {
  const fake = createMemoryDatabase({
    selectedRows: [
      [{ emailVerified: now, passwordHash: "stored-hash", role: "student" }],
      [{ id: "reset-id", sentAt: new Date(now.getTime() - PASSWORD_RESET_CODE_RESEND_DELAY_MS) }],
    ],
  });

  const result = await issuePasswordResetCode(userId, now, fake.database);

  assert.equal(result.ok, true);
  assert.equal(fake.updates.length, 1);
  assert.equal(fake.updates[0].table, schema.passwordResetCodes);
  assert.equal(fake.updates[0].values?.attempts, 0);
  assert.equal(fake.updates[0].values?.sentAt, now);
  assert.equal(fake.updates[0].values?.consumedAt, null);
  assert.deepEqual(fake.inserts, []);
});

test("verifyPasswordResetCode rejects malformed input before opening a transaction", async () => {
  for (const code of ["", "12345", "1234567", "12a456"]) {
    const fake = createMemoryDatabase();

    assert.deepEqual(await verifyPasswordResetCode(userId, code, now, fake.database), {
      ok: false,
      reason: "invalid_input",
    });
    assert.equal(fake.transactionCount, 0);
  }
});

test("verifyPasswordResetCode rejects an unavailable code", async () => {
  const fake = createMemoryDatabase({ updateResults: [[]] });

  assert.deepEqual(await verifyPasswordResetCode(userId, "012345", now, fake.database), {
    ok: false,
    reason: "code_unavailable",
  });
  assert.equal(fake.updates.length, 1);
});

test("verifyPasswordResetCode records an invalid attempt without consuming", async () => {
  const fake = createMemoryDatabase({
    updateResults: [[{ codeHash: hashPasswordResetCode(userId, "999999") }]],
  });

  assert.deepEqual(await verifyPasswordResetCode(userId, "012345", now, fake.database), {
    ok: false,
    reason: "invalid_code",
  });
  assert.equal(fake.updates.length, 1);
  assert.equal(fake.updates[0].table, schema.passwordResetCodes);
});

test("verifyPasswordResetCode consumes a valid code without marking the email verified", async () => {
  const fake = createMemoryDatabase({
    updateResults: [[{ codeHash: hashPasswordResetCode(userId, "012345") }]],
  });

  assert.deepEqual(await verifyPasswordResetCode(userId, " 012345 ", now, fake.database), { ok: true });
  assert.equal(fake.updates.length, 2);
  assert.equal(fake.updates[0].table, schema.passwordResetCodes);
  assert.notEqual(fake.updates[0].values?.attempts, undefined);
  assert.equal(fake.updates[1].table, schema.passwordResetCodes);
  assert.equal(fake.updates[1].values?.consumedAt, now);
  assert.equal(fake.deletes.length, 0);
});

test("setStudentPassword rejects an invalid password before opening a transaction", async () => {
  const fake = createMemoryDatabase();

  assert.deepEqual(await setStudentPassword(userId, "short", fake.database), {
    ok: false,
    reason: "invalid_input",
  });
  assert.equal(fake.transactionCount, 0);
});

test("setStudentPassword reports a missing user", async () => {
  const fake = createMemoryDatabase({ updateResults: [[]] });

  assert.deepEqual(await setStudentPassword(userId, "secure password", fake.database), {
    ok: false,
    reason: "not_found",
  });
  assert.equal(fake.deletes.length, 0);
});

test("setStudentPassword updates the hash and deletes every session for the user", async () => {
  const fake = createMemoryDatabase({ updateResults: [[{ id: userId }]] });

  const result = await setStudentPassword(userId, "secure password", fake.database);

  assert.equal(result.ok, true);
  assert.equal(fake.updates.length, 1);
  assert.equal(fake.updates[0].table, schema.users);
  assert.equal(
    typeof fake.updates[0].values?.passwordHash === "string"
      && (fake.updates[0].values?.passwordHash as string).startsWith("scrypt$"),
    true,
  );
  assert.notEqual(fake.updates[0].values?.passwordHash, hashPassword("secure password"));
  assert.equal(fake.deletes.length, 1);
  assert.equal(fake.deletes[0].table, schema.sessions);
});

test("requestPasswordReset returns the sentinel for a missing account", async () => {
  const fake = createMemoryDatabase({ selectedRows: [[]] });

  const result = await requestPasswordReset("university-id", "student@example.com", fake.database, now);

  assert.deepEqual(result, { kind: "unknown", userId: PASSWORD_RESET_UNKNOWN_USER_ID });
  assert.equal(fake.transactionCount, 0);
  assert.equal(fake.executeCalls, 0);
});

test("requestPasswordReset issues a code for an eligible student", async () => {
  const fake = createMemoryDatabase({
    selectedRows: [
      [{ id: userId }],
      [],
      [{ emailVerified: now, passwordHash: "stored-hash", role: "student" }],
      [],
    ],
    executeRows: [[{ attempts: "1", blocked_until: null }]],
  });

  const result = await requestPasswordReset("university-id", "student@example.com", fake.database, now);

  assert.equal(result.kind, "issued");
  if (result.kind !== "issued") return;
  assert.equal(result.userId, userId);
  assert.equal(result.code.length, 6);
  assert.equal(fake.transactionCount, 1);
  assert.equal(fake.executeCalls, 1);
  assert.equal(fake.selects.length, 4);
  assert.equal(fake.selects[0].table, schema.users);
});

test("requestPasswordReset returns existing without a code for an ineligible account", async () => {
  const fake = createMemoryDatabase({
    selectedRows: [
      [{ id: userId }],
      [],
      [{ emailVerified: now, passwordHash: null, role: "student" }],
    ],
  });

  const result = await requestPasswordReset("university-id", "student@example.com", fake.database, now);

  assert.deepEqual(result, { kind: "existing", userId });
  assert.equal(fake.transactionCount, 1);
  assert.equal(fake.executeCalls, 0);
});

test("requestPasswordReset returns existing without a new code when rate-limited", async () => {
  const blockedUntil = new Date(now.getTime() + 60000);
  const fake = createMemoryDatabase({
    selectedRows: [[{ id: userId }], [{ blockedUntil }]],
  });

  const result = await requestPasswordReset("university-id", "student@example.com", fake.database, now);

  assert.deepEqual(result, { kind: "existing", userId });
  assert.equal(fake.transactionCount, 0);
  assert.equal(fake.executeCalls, 0);
});

test("requestPasswordReset returns existing while the resend delay is active", async () => {
  const fake = createMemoryDatabase({
    selectedRows: [
      [{ id: userId }],
      [],
      [{ emailVerified: now, passwordHash: "stored-hash", role: "student" }],
      [{ id: "reset-id", sentAt: new Date(now.getTime() - PASSWORD_RESET_CODE_RESEND_DELAY_MS + 1) }],
    ],
  });

  const result = await requestPasswordReset("university-id", "student@example.com", fake.database, now);

  assert.deepEqual(result, { kind: "existing", userId });
  assert.equal(fake.transactionCount, 1);
  assert.equal(fake.executeCalls, 0);
});

test("resendPasswordResetCode is rate-limited after too many sends", async () => {
  const blockedUntil = new Date(now.getTime() + 60000);
  const fake = createMemoryDatabase({ selectedRows: [[{ blockedUntil }]] });

  const result = await resendPasswordResetCode(userId, fake.database, now);

  assert.deepEqual(result, { ok: false, reason: "rate_limited" });
  assert.equal(fake.transactionCount, 0);
  assert.equal(fake.executeCalls, 0);
});

test("resendPasswordResetCode enforces the resend delay", async () => {
  const fake = createMemoryDatabase({
    selectedRows: [
      [],
      [{ emailVerified: now, passwordHash: "stored-hash", role: "student" }],
      [{ id: "reset-id", sentAt: new Date(now.getTime() - PASSWORD_RESET_CODE_RESEND_DELAY_MS + 1) }],
    ],
  });

  const result = await resendPasswordResetCode(userId, fake.database, now);

  assert.deepEqual(result, { ok: false, reason: "too_soon" });
  assert.equal(fake.executeCalls, 0);
});

test("resendPasswordResetCode rejects an unknown user", async () => {
  const fake = createMemoryDatabase({ selectedRows: [[], []] });

  const result = await resendPasswordResetCode(userId, fake.database, now);

  assert.deepEqual(result, { ok: false, reason: "not_found" });
  assert.equal(fake.executeCalls, 0);
});

test("resendPasswordResetCode rejects an ineligible account", async () => {
  const fake = createMemoryDatabase({
    selectedRows: [
      [],
      [{ emailVerified: now, passwordHash: null, role: "student" }],
    ],
  });

  const result = await resendPasswordResetCode(userId, fake.database, now);

  assert.deepEqual(result, { ok: false, reason: "no_password" });
  assert.equal(fake.executeCalls, 0);
});

test("resendPasswordResetCode issues a code and returns the email", async () => {
  const fake = createMemoryDatabase({
    selectedRows: [
      [],
      [{ emailVerified: now, passwordHash: "stored-hash", role: "student" }],
      [],
      [{ email: "student@example.com" }],
    ],
    executeRows: [[{ attempts: "1", blocked_until: null }]],
  });

  const result = await resendPasswordResetCode(userId, fake.database, now);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.email, "student@example.com");
  assert.equal(result.code.length, 6);
  assert.equal(fake.executeCalls, 1);
});
