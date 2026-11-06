import assert from "node:assert/strict";
import test from "node:test";
import {
  checkRateLimit,
  hashAttemptKey,
  RATE_LIMITS,
  recordFailure,
  resetAttempts,
} from "../src/auth-attempts";
import * as schema from "../src/schema";

type SelectQuery = {
  from: (table: unknown) => SelectQuery;
  where: (condition: unknown) => SelectQuery;
  limit: (count: number) => Promise<unknown[]>;
};

type InsertRecord = {
  table: unknown;
  values?: Record<string, unknown>;
  target?: unknown;
  set?: Record<string, unknown>;
};

type DeleteRecord = {
  table: unknown;
  condition?: unknown;
};

function createMemoryDatabase({
  selectedRows = [],
  executeRows = [],
}: {
  selectedRows?: unknown[][];
  executeRows?: Array<Array<Record<string, unknown>>>;
} = {}) {
  const selects: Array<{ table?: unknown; condition?: unknown }> = [];
  const inserts: InsertRecord[] = [];
  const deletes: DeleteRecord[] = [];
  let executeCalls = 0;
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
    insert: (table: unknown) => {
      const record: InsertRecord = { table };
      inserts.push(record);
      const chain = {
        values: (values: Record<string, unknown>) => {
          record.values = values;
          return chain;
        },
        onConflictDoUpdate: (config: { target: unknown; set: Record<string, unknown> }) => {
          record.target = config.target;
          record.set = config.set;
          return chain;
        },
      };
      return chain;
    },
    delete: (table: unknown) => {
      const record: DeleteRecord = { table };
      deletes.push(record);
      const chain = {
        where: (condition: unknown) => {
          record.condition = condition;
          return chain;
        },
      };
      return chain;
    },
    execute: async () => {
      executeCalls++;
      const rows = executeRows.shift() ?? [];
      return { rows };
    },
  };

  return {
    database: {
      select: tx.select,
      insert: tx.insert,
      delete: tx.delete,
      transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => {
        transactionCount++;
        return callback(tx);
      },
      execute: async () => {
        executeCalls++;
        const rows = executeRows.shift() ?? [];
        return { rows };
      },
    } as never,
    selects,
    inserts,
    deletes,
    get executeCalls() {
      return executeCalls;
    },
    get transactionCount() {
      return transactionCount;
    },
  };
}

const now = new Date("2026-10-27T10:00:00.000Z");
const action = "login" as const;
const identifier = "User@example.com";

test("hashAttemptKey is stable and case-insensitive", () => {
  assert.equal(hashAttemptKey(action, identifier), hashAttemptKey(action, " user@example.com "));
  assert.notEqual(hashAttemptKey(action, identifier), hashAttemptKey("signup_code", identifier));
});

test("checkRateLimit allows a blank record", async () => {
  const fake = createMemoryDatabase({ selectedRows: [[]] });

  assert.deepEqual(await checkRateLimit(action, identifier, now, fake.database), { allowed: true });
  assert.equal(fake.selects.length, 1);
});

test("checkRateLimit denies while blocked", async () => {
  const retryAt = new Date(now.getTime() + RATE_LIMITS.login.blockMs);
  const fake = createMemoryDatabase({ selectedRows: [[{ blockedUntil: retryAt }]] });

  assert.deepEqual(await checkRateLimit(action, identifier, now, fake.database), {
    allowed: false,
    retryAt,
  });
});

test("recordFailure performs a single execute and converts the returned values", async () => {
  const fake = createMemoryDatabase({
    executeRows: [[{ attempts: "3", blocked_until: "2026-10-27T10:10:00.000Z" }]],
  });

  const result = await recordFailure(action, identifier, now, fake.database);

  assert.deepEqual(result, { attempts: 3, blockedUntil: new Date("2026-10-27T10:10:00.000Z") });
  assert.equal(fake.executeCalls, 1);
  assert.equal(fake.selects.length, 0);
});

test("recordFailure preserves a null blockedUntil when the SQL result has no block", async () => {
  const fake = createMemoryDatabase({
    executeRows: [[{ attempts: "1", blocked_until: null }]],
  });

  const result = await recordFailure(action, identifier, now, fake.database);

  assert.deepEqual(result, { attempts: 1, blockedUntil: null });
  assert.equal(fake.executeCalls, 1);
});

test("resetAttempts removes the stored attempt row", async () => {
  const fake = createMemoryDatabase({ selectedRows: [[]] });

  await resetAttempts(action, identifier, fake.database);

  assert.equal(fake.deletes.length, 1);
  assert.equal(fake.deletes[0].table, schema.authAttempts);
});

test("RATE_LIMITS for email send uses a one-hour window and block", () => {
  assert.equal(RATE_LIMITS.email_send.windowMs, 3600000);
  assert.equal(RATE_LIMITS.email_send.blockMs, 3600000);
  assert.equal(RATE_LIMITS.email_send.maxAttempts, 5);
});

test("RATE_LIMITS for verify_code allows 5 failures with a 15-minute window and block", () => {
  assert.equal(RATE_LIMITS.verify_code.maxAttempts, 5);
  assert.equal(RATE_LIMITS.verify_code.windowMs, 900000);
  assert.equal(RATE_LIMITS.verify_code.blockMs, 900000);
});

test("hashAttemptKey separates verify_code from login", () => {
  assert.notEqual(hashAttemptKey("verify_code", identifier), hashAttemptKey(action, identifier));
});
