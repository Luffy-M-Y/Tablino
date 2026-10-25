import assert from "node:assert/strict";
import test from "node:test";
import {
  ACCESS_CODE_ALPHABET,
  computeAccessCodeExpiry,
  createAccessCode,
  generateAccessCode,
  getAccessCodeStatus,
  hashAccessCode,
  isAccessCodeFormatValid,
  isMaxUsesValid,
  normalizeAccessCode,
  revokeAccessCode,
} from "../src/access-codes";
import * as schema from "../src/schema";

type InsertRecord = {
  table: unknown;
  values?: Record<string, unknown>;
  conflictTarget?: unknown;
};

type UpdateRecord = {
  table: unknown;
  values: Record<string, unknown>;
  condition?: unknown;
};

type SelectQuery = {
  from: (table: unknown) => SelectQuery;
  where: (condition: unknown) => SelectQuery;
  for: (mode: "update") => SelectQuery;
  limit: (count: number) => Promise<unknown[]>;
};

type InsertChain = {
  values: (values: Record<string, unknown>) => InsertChain;
  onConflictDoNothing: (config: { target: unknown }) => InsertChain;
  returning: (selection: Record<string, unknown>) => Promise<unknown[]>;
};

type UpdateChain = {
  set: (values: Record<string, unknown>) => UpdateChain;
  where: (condition: unknown) => Promise<void>;
};

function createMemoryDatabase(
  insertResults: unknown[][] = [],
  selectedRows: unknown[] = [],
) {
  const inserts: InsertRecord[] = [];
  const updates: UpdateRecord[] = [];
  const selectedTables: unknown[] = [];
  const lockModes: string[] = [];
  let transactionCount = 0;

  const tx = {
    insert: (table: unknown) => {
      const record: InsertRecord = { table };
      inserts.push(record);
      const chain: InsertChain = {
        values: (values) => {
          record.values = values;
          return chain;
        },
        onConflictDoNothing: ({ target }) => {
          record.conflictTarget = target;
          return chain;
        },
        returning: async () => insertResults.shift() ?? [],
      };
      return chain;
    },
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
      const record: UpdateRecord = { table, values: {} };
      const chain: UpdateChain = {
        set: (values) => {
          record.values = values;
          return chain;
        },
        where: async (condition) => {
          record.condition = condition;
          updates.push(record);
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
    inserts,
    updates,
    selectedTables,
    lockModes,
    get transactionCount() {
      return transactionCount;
    },
  };
}

test("generateAccessCode returns twelve alphabet characters in three groups and differs across calls", () => {
  const first = generateAccessCode();
  const second = generateAccessCode();
  const normalized = first.split("-").join("");

  assert.equal(first.length, 14);
  assert.equal(first[4], "-");
  assert.equal(first[9], "-");
  assert.equal(normalized.length, 12);
  assert.equal(Array.from(normalized).every((character) => ACCESS_CODE_ALPHABET.includes(character)), true);
  assert.notEqual(first, second);
});

test("normalizeAccessCode trims, uppercases, and removes hyphens and spaces", () => {
  assert.equal(normalizeAccessCode(" abcd-efgh-jklm "), "ABCDEFGHJKLM");
});

test("isAccessCodeFormatValid accepts only twelve allowed characters", () => {
  assert.equal(isAccessCodeFormatValid("ABCDEFGHJKLM"), true);
  assert.equal(isAccessCodeFormatValid("ABCDEFGHJKL"), false);
  assert.equal(isAccessCodeFormatValid("ABCDEFGHJKLO"), false);
  assert.equal(isAccessCodeFormatValid("ABCDEFGHJKLI"), false);
  assert.equal(isAccessCodeFormatValid("ABCDEFGHJKL0"), false);
  assert.equal(isAccessCodeFormatValid("ABCDEFGHJKL1"), false);
});

test("hashAccessCode hashes the normalized code", () => {
  const hash = hashAccessCode("ABCD-EFGH-JKLM");

  assert.equal(hash.length, 64);
  assert.equal(hashAccessCode("ABCD-EFGH-JKLM"), hashAccessCode("ABCDEFGHJKLM"));
  assert.notEqual(hashAccessCode("ABCDEFGHJKLM"), hashAccessCode("BCDEFGHJKLMN"));
});

test("isMaxUsesValid accepts the inclusive limit and rejects invalid values", () => {
  assert.equal(isMaxUsesValid(1), true);
  assert.equal(isMaxUsesValid(5000), true);
  assert.equal(isMaxUsesValid(0), false);
  assert.equal(isMaxUsesValid(5001), false);
  assert.equal(isMaxUsesValid(1.5), false);
  assert.equal(isMaxUsesValid(Number.NaN), false);
  assert.equal(isMaxUsesValid("1"), false);
});

test("computeAccessCodeExpiry returns exactly twenty-four hours later", () => {
  const now = new Date("2026-10-24T00:00:00.000Z");
  const expiry = computeAccessCodeExpiry(now);

  assert.equal(expiry.getTime() - now.getTime(), 24 * 60 * 60 * 1000);
});

test("getAccessCodeStatus reports usable, revoked, expired, and exhausted states", () => {
  const now = new Date("2026-10-24T00:00:00.000Z");

  assert.equal(getAccessCodeStatus({
    expiresAt: new Date(now.getTime() + 1),
    revokedAt: null,
    usesCount: 0,
    maxUses: 1,
  }, now), "usable");
  assert.equal(getAccessCodeStatus({
    expiresAt: new Date(now.getTime() + 1),
    revokedAt: new Date(now.getTime()),
    usesCount: 0,
    maxUses: 1,
  }, now), "revoked");
  assert.equal(getAccessCodeStatus({
    expiresAt: now,
    revokedAt: null,
    usesCount: 0,
    maxUses: 1,
  }, now), "expired");
  assert.equal(getAccessCodeStatus({
    expiresAt: new Date(now.getTime() + 1),
    revokedAt: null,
    usesCount: 1,
    maxUses: 1,
  }, now), "exhausted");
});

test("revoked status takes priority over expired status", () => {
  const now = new Date("2026-10-24T00:00:00.000Z");

  assert.equal(getAccessCodeStatus({
    expiresAt: now,
    revokedAt: new Date(now.getTime()),
    usesCount: 1,
    maxUses: 1,
  }, now), "revoked");
});

test("createAccessCode rejects invalid maxUses without opening a transaction", async () => {
  for (const maxUses of [0, 5001, 1.5]) {
    const fake = createMemoryDatabase();

    assert.deepEqual(
      await createAccessCode("university-a", maxUses, fake.database),
      { ok: false, reason: "invalid_max_uses" },
    );
    assert.equal(fake.transactionCount, 0);
    assert.deepEqual(fake.inserts, []);
  }
});

test("createAccessCode inserts a hashed code with the requested expiry and use limit", async () => {
  const now = new Date("2026-10-24T00:00:00.000Z");
  const fake = createMemoryDatabase([[{ id: "access-code-a" }]]);

  const result = await createAccessCode("university-a", 12, fake.database, now);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(isAccessCodeFormatValid(normalizeAccessCode(result.code)), true);
  assert.equal(result.id, "access-code-a");
  assert.equal(result.maxUses, 12);
  assert.equal(result.expiresAt.getTime(), now.getTime() + 24 * 60 * 60 * 1000);
  assert.equal(fake.inserts.length, 1);
  assert.equal(fake.inserts[0].table, schema.accessCodes);
  assert.equal(fake.inserts[0].values?.universityId, "university-a");
  assert.equal(fake.inserts[0].values?.codeHash, hashAccessCode(result.code));
  assert.equal(fake.inserts[0].values?.maxUses, 12);
  assert.equal(
    (fake.inserts[0].values?.expiresAt as Date).getTime(),
    now.getTime() + 24 * 60 * 60 * 1000,
  );
  assert.equal(fake.inserts[0].conflictTarget, schema.accessCodes.codeHash);
});

test("createAccessCode retries once after a code hash conflict", async () => {
  const fake = createMemoryDatabase([[], [{ id: "access-code-a" }]]);

  const result = await createAccessCode("university-a", 1, fake.database);

  assert.equal(result.ok, true);
  assert.equal(fake.inserts.length, 2);
});

test("createAccessCode stops after three code hash conflicts", async () => {
  const fake = createMemoryDatabase([[], [], []]);

  assert.deepEqual(
    await createAccessCode("university-a", 1, fake.database),
    { ok: false, reason: "code_generation_failed" },
  );
  assert.equal(fake.inserts.length, 3);
});

test("revokeAccessCode returns not_found without updating a missing code", async () => {
  const fake = createMemoryDatabase([], []);

  assert.deepEqual(
    await revokeAccessCode("university-a", "access-code-a", fake.database),
    { ok: false, reason: "not_found" },
  );
  assert.deepEqual(fake.selectedTables, [schema.accessCodes]);
  assert.deepEqual(fake.updates, []);
});

test("revokeAccessCode leaves an already revoked code unchanged", async () => {
  const fake = createMemoryDatabase([], [{ id: "access-code-a", revokedAt: new Date() }]);

  assert.deepEqual(
    await revokeAccessCode("university-a", "access-code-a", fake.database),
    { ok: true },
  );
  assert.deepEqual(fake.lockModes, ["update"]);
  assert.deepEqual(fake.updates, []);
});

test("revokeAccessCode timestamps an active code after locking it", async () => {
  const now = new Date("2026-10-24T00:00:00.000Z");
  const fake = createMemoryDatabase([], [{ id: "access-code-a", revokedAt: null }]);

  assert.deepEqual(
    await revokeAccessCode("university-a", "access-code-a", fake.database, now),
    { ok: true },
  );
  assert.deepEqual(fake.lockModes, ["update"]);
  assert.equal(fake.updates.length, 1);
  assert.equal(fake.updates[0].table, schema.accessCodes);
  assert.equal(fake.updates[0].values.revokedAt, now);
});
