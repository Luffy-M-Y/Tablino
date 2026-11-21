import assert from "node:assert/strict";
import test from "node:test";
import {
  createAdminGoogleAuthContextDrizzleRepository,
  createAdminGoogleAuthContextService,
  type AdminGoogleAuthContextRecord,
  type AdminGoogleAuthContextRepository,
} from "../src/admin-google-auth-context";

const NOW = new Date("2026-12-01T10:00:00.000Z");
const TTL_MS = 60_000;

type StoredContext = {
  id: string;
  providerAccountId: string;
  surface: "admin" | "web";
  email: string;
  universityId: string | null;
  at: Date;
  expiresAt: Date;
};

function createFakeHarness(initialRows: StoredContext[] = []) {
  const rows: StoredContext[] = [...initialRows];
  let insertConflictRow: StoredContext | null = null;
  const inserts: Array<{
    providerAccountId: string;
    surface: "admin" | "web";
    email: string;
    universityId: string | null;
    at: Date;
    expiresAt: Date;
  }> = [];
  const updates: Array<{
    id?: string;
    providerAccountId: string;
    surface: "admin" | "web";
    at: Date;
    expiresAt: Date;
  }> = [];
  const deletes: Array<{ providerAccountId: string; surface: "admin" | "web" }> = [];
  const prunedCalls: Date[] = [];

  const repository: AdminGoogleAuthContextRepository = {
    async record(input) {
      for (let i = rows.length - 1; i >= 0; i--) {
        if (rows[i].expiresAt <= input.at) {
          rows.splice(i, 1);
        }
      }

      const existing = rows.find(
        (r) => r.providerAccountId === input.providerAccountId && r.surface === input.surface,
      );

      if (existing) {
        if (existing.email !== input.email || existing.universityId !== input.universityId) {
          return { accepted: false };
        }
        existing.at = input.at;
        existing.expiresAt = input.expiresAt;
        updates.push({
          id: existing.id,
          providerAccountId: input.providerAccountId,
          surface: input.surface,
          at: input.at,
          expiresAt: input.expiresAt,
        });
        return { accepted: true };
      }

      if (insertConflictRow) {
        const conflict = insertConflictRow;
        if (conflict.email !== input.email || conflict.universityId !== input.universityId) {
          return { accepted: false };
        }
        conflict.at = input.at;
        conflict.expiresAt = input.expiresAt;
        updates.push({
          id: conflict.id,
          providerAccountId: input.providerAccountId,
          surface: input.surface,
          at: input.at,
          expiresAt: input.expiresAt,
        });
        return { accepted: true };
      }

      const newRow: StoredContext = {
        id: `ctx-${rows.length + 1}`,
        ...input,
      };
      rows.push(newRow);
      inserts.push({ ...input });
      return { accepted: true };
    },

    async consume({ providerAccountId, surface, now }) {
      const index = rows.findIndex(
        (r) =>
          r.providerAccountId === providerAccountId
          && r.surface === surface
          && r.expiresAt > now,
      );
      if (index === -1) return null;
      const [deleted] = rows.splice(index, 1);
      return {
        email: deleted.email,
        universityId: deleted.universityId,
        at: deleted.at,
      };
    },

    async delete({ providerAccountId, surface }) {
      deletes.push({ providerAccountId, surface });
      const index = rows.findIndex(
        (r) => r.providerAccountId === providerAccountId && r.surface === surface,
      );
      if (index !== -1) {
        rows.splice(index, 1);
      }
    },

    async pruneExpired(now) {
      prunedCalls.push(now);
      for (let i = rows.length - 1; i >= 0; i--) {
        if (rows[i].expiresAt <= now) {
          rows.splice(i, 1);
        }
      }
    },
  };

  const service = createAdminGoogleAuthContextService({ repository });

  return {
    rows,
    inserts,
    updates,
    deletes,
    prunedCalls,
    repository,
    service,
    setInsertConflict(row: StoredContext | null) {
      insertConflictRow = row;
    },
  };
}

test("record accepts a new Google auth context and performs an insert", async () => {
  const harness = createFakeHarness();

  const result = await harness.service.recordGoogleAuthContext({
    providerAccountId: "google-acc-1",
    surface: "web",
    email: "student@example.test",
    universityId: "univ-1",
    now: NOW,
    ttlMs: TTL_MS,
  });

  assert.deepEqual(result, { accepted: true });
  assert.equal(harness.inserts.length, 1);
  assert.deepEqual(harness.updates, []);
  assert.deepEqual(harness.inserts[0], {
    providerAccountId: "google-acc-1",
    surface: "web",
    email: "student@example.test",
    universityId: "univ-1",
    at: NOW,
    expiresAt: new Date(NOW.getTime() + TTL_MS),
  });
});

test("record accepts replaying the same context and updates timestamps", async () => {
  const harness = createFakeHarness();

  await harness.service.recordGoogleAuthContext({
    providerAccountId: "google-acc-1",
    surface: "web",
    email: "student@example.test",
    universityId: "univ-1",
    now: NOW,
    ttlMs: TTL_MS,
  });
  assert.equal(harness.inserts.length, 1);
  assert.equal(harness.updates.length, 0);

  const later = new Date(NOW.getTime() + 10_000);
  const replayed = await harness.service.recordGoogleAuthContext({
    providerAccountId: "google-acc-1",
    surface: "web",
    email: "student@example.test",
    universityId: "univ-1",
    now: later,
    ttlMs: TTL_MS,
  });

  assert.deepEqual(replayed, { accepted: true });
  assert.equal(harness.inserts.length, 1);
  assert.equal(harness.updates.length, 1);
  assert.deepEqual(harness.updates[0], {
    id: "ctx-1",
    providerAccountId: "google-acc-1",
    surface: "web",
    at: later,
    expiresAt: new Date(later.getTime() + TTL_MS),
  });
});

test("record rejects a different email with simulated valid row and proves no writes", async () => {
  const existingRow: StoredContext = {
    id: "ctx-existing-1",
    providerAccountId: "google-acc-1",
    surface: "web",
    email: "student@example.test",
    universityId: "univ-1",
    at: NOW,
    expiresAt: new Date(NOW.getTime() + TTL_MS),
  };
  const harness = createFakeHarness([existingRow]);

  const result = await harness.service.recordGoogleAuthContext({
    providerAccountId: "google-acc-1",
    surface: "web",
    email: "other@example.test",
    universityId: "univ-1",
    now: NOW,
    ttlMs: TTL_MS,
  });

  assert.deepEqual(result, { accepted: false });
  assert.deepEqual(harness.inserts, []);
  assert.deepEqual(harness.updates, []);
});

test("record rejects a different universityId with simulated valid row and proves no writes", async () => {
  const existingRow: StoredContext = {
    id: "ctx-existing-1",
    providerAccountId: "google-acc-1",
    surface: "web",
    email: "student@example.test",
    universityId: "univ-1",
    at: NOW,
    expiresAt: new Date(NOW.getTime() + TTL_MS),
  };
  const harness = createFakeHarness([existingRow]);

  const resultDifferentUniv = await harness.service.recordGoogleAuthContext({
    providerAccountId: "google-acc-1",
    surface: "web",
    email: "student@example.test",
    universityId: "univ-2",
    now: NOW,
    ttlMs: TTL_MS,
  });

  assert.deepEqual(resultDifferentUniv, { accepted: false });
  assert.deepEqual(harness.inserts, []);
  assert.deepEqual(harness.updates, []);

  const resultNullUniv = await harness.service.recordGoogleAuthContext({
    providerAccountId: "google-acc-1",
    surface: "web",
    email: "student@example.test",
    universityId: null,
    now: NOW,
    ttlMs: TTL_MS,
  });

  assert.deepEqual(resultNullUniv, { accepted: false });
  assert.deepEqual(harness.inserts, []);
  assert.deepEqual(harness.updates, []);
});

test("record accepts admin surface with null universityId and replays successfully", async () => {
  const harness = createFakeHarness();

  const result = await harness.service.recordGoogleAuthContext({
    providerAccountId: "google-admin-1",
    surface: "admin",
    email: "admin@example.test",
    universityId: null,
    now: NOW,
    ttlMs: TTL_MS,
  });

  assert.deepEqual(result, { accepted: true });
  assert.equal(harness.inserts.length, 1);
  assert.equal(harness.inserts[0].surface, "admin");
  assert.equal(harness.inserts[0].universityId, null);

  const later = new Date(NOW.getTime() + 5_000);
  const replayed = await harness.service.recordGoogleAuthContext({
    providerAccountId: "google-admin-1",
    surface: "admin",
    email: "admin@example.test",
    universityId: null,
    now: later,
    ttlMs: TTL_MS,
  });

  assert.deepEqual(replayed, { accepted: true });
  assert.equal(harness.updates.length, 1);
  assert.equal(harness.updates[0].surface, "admin");
});

test("consume returns the stored context and then null on second call", async () => {
  const harness = createFakeHarness();

  await harness.service.recordGoogleAuthContext({
    providerAccountId: "google-acc-1",
    surface: "web",
    email: "student@example.test",
    universityId: "univ-1",
    now: NOW,
    ttlMs: TTL_MS,
  });

  const firstConsume = await harness.service.consumeGoogleAuthContext({
    providerAccountId: "google-acc-1",
    surface: "web",
    now: NOW,
  });
  assert.deepEqual(firstConsume, {
    email: "student@example.test",
    universityId: "univ-1",
    at: NOW,
  });

  const secondConsume = await harness.service.consumeGoogleAuthContext({
    providerAccountId: "google-acc-1",
    surface: "web",
    now: NOW,
  });
  assert.equal(secondConsume, null);
});

test("consume of an expired context returns null", async () => {
  const harness = createFakeHarness();

  await harness.service.recordGoogleAuthContext({
    providerAccountId: "google-acc-1",
    surface: "web",
    email: "student@example.test",
    universityId: "univ-1",
    now: NOW,
    ttlMs: TTL_MS,
  });

  const expiredConsume = await harness.service.consumeGoogleAuthContext({
    providerAccountId: "google-acc-1",
    surface: "web",
    now: new Date(NOW.getTime() + TTL_MS + 1),
  });
  assert.equal(expiredConsume, null);
});

test("consume on a different surface returns null", async () => {
  const harness = createFakeHarness();

  await harness.service.recordGoogleAuthContext({
    providerAccountId: "google-acc-1",
    surface: "web",
    email: "student@example.test",
    universityId: "univ-1",
    now: NOW,
    ttlMs: TTL_MS,
  });

  const crossSurfaceConsume = await harness.service.consumeGoogleAuthContext({
    providerAccountId: "google-acc-1",
    surface: "admin",
    now: NOW,
  });
  assert.equal(crossSurfaceConsume, null);

  const correctSurfaceConsume = await harness.service.consumeGoogleAuthContext({
    providerAccountId: "google-acc-1",
    surface: "web",
    now: NOW,
  });
  assert.deepEqual(correctSurfaceConsume, {
    email: "student@example.test",
    universityId: "univ-1",
    at: NOW,
  });
});

test("delete removes the stored context and is idempotent", async () => {
  const harness = createFakeHarness();

  await harness.service.recordGoogleAuthContext({
    providerAccountId: "google-acc-1",
    surface: "web",
    email: "student@example.test",
    universityId: "univ-1",
    now: NOW,
    ttlMs: TTL_MS,
  });

  await harness.service.deleteGoogleAuthContext({
    providerAccountId: "google-acc-1",
    surface: "web",
  });
  assert.equal(harness.deletes.length, 1);

  const consumed = await harness.service.consumeGoogleAuthContext({
    providerAccountId: "google-acc-1",
    surface: "web",
    now: NOW,
  });
  assert.equal(consumed, null);

  await harness.service.deleteGoogleAuthContext({
    providerAccountId: "google-acc-1",
    surface: "web",
  });
  assert.equal(harness.deletes.length, 2);
});

test("pruneExpired removes expired contexts while keeping active ones", async () => {
  const harness = createFakeHarness();

  await harness.service.recordGoogleAuthContext({
    providerAccountId: "expired-acc",
    surface: "web",
    email: "expired@example.test",
    universityId: null,
    now: NOW,
    ttlMs: TTL_MS,
  });

  const laterTime = new Date(NOW.getTime() + TTL_MS + 10_000);
  await harness.service.recordGoogleAuthContext({
    providerAccountId: "active-acc",
    surface: "web",
    email: "active@example.test",
    universityId: null,
    now: laterTime,
    ttlMs: TTL_MS,
  });

  const pruneCutoff = new Date(NOW.getTime() + TTL_MS + 1_000);
  await harness.service.pruneExpiredGoogleAuthContexts(pruneCutoff);

  const expiredConsume = await harness.service.consumeGoogleAuthContext({
    providerAccountId: "expired-acc",
    surface: "web",
    now: pruneCutoff,
  });
  assert.equal(expiredConsume, null);

  const activeConsume = await harness.service.consumeGoogleAuthContext({
    providerAccountId: "active-acc",
    surface: "web",
    now: pruneCutoff,
  });
  assert.deepEqual(activeConsume, {
    email: "active@example.test",
    universityId: null,
    at: laterTime,
  });
});

test("record handles insert conflict: updates dates if same context, rejects without writes if different", async () => {
  const harness = createFakeHarness();

  // (a) même contexte : accepté, mise à jour des dates
  const sameConflictRow: StoredContext = {
    id: "ctx-conflict-1",
    providerAccountId: "google-conflict-1",
    surface: "web",
    email: "student@example.test",
    universityId: "univ-1",
    at: NOW,
    expiresAt: new Date(NOW.getTime() + TTL_MS),
  };
  harness.setInsertConflict(sameConflictRow);

  const later = new Date(NOW.getTime() + 15_000);
  const acceptedResult = await harness.service.recordGoogleAuthContext({
    providerAccountId: "google-conflict-1",
    surface: "web",
    email: "student@example.test",
    universityId: "univ-1",
    now: later,
    ttlMs: TTL_MS,
  });

  assert.deepEqual(acceptedResult, { accepted: true });
  assert.deepEqual(harness.inserts, []);
  assert.equal(harness.updates.length, 1);
  assert.deepEqual(harness.updates[0], {
    id: "ctx-conflict-1",
    providerAccountId: "google-conflict-1",
    surface: "web",
    at: later,
    expiresAt: new Date(later.getTime() + TTL_MS),
  });

  // (b) email différent : refusé, updates et inserts = []
  const harnessEmailDiff = createFakeHarness();
  const differentEmailRow: StoredContext = {
    id: "ctx-conflict-2",
    providerAccountId: "google-conflict-2",
    surface: "web",
    email: "original@example.test",
    universityId: "univ-1",
    at: NOW,
    expiresAt: new Date(NOW.getTime() + TTL_MS),
  };
  harnessEmailDiff.setInsertConflict(differentEmailRow);

  const diffEmailResult = await harnessEmailDiff.service.recordGoogleAuthContext({
    providerAccountId: "google-conflict-2",
    surface: "web",
    email: "different@example.test",
    universityId: "univ-1",
    now: NOW,
    ttlMs: TTL_MS,
  });

  assert.deepEqual(diffEmailResult, { accepted: false });
  assert.deepEqual(harnessEmailDiff.inserts, []);
  assert.deepEqual(harnessEmailDiff.updates, []);

  // (c) universityId différent : refusé, updates et inserts = []
  const harnessUnivDiff = createFakeHarness();
  const differentUnivRow: StoredContext = {
    id: "ctx-conflict-3",
    providerAccountId: "google-conflict-3",
    surface: "web",
    email: "student@example.test",
    universityId: "univ-1",
    at: NOW,
    expiresAt: new Date(NOW.getTime() + TTL_MS),
  };
  harnessUnivDiff.setInsertConflict(differentUnivRow);

  const diffUnivResult = await harnessUnivDiff.service.recordGoogleAuthContext({
    providerAccountId: "google-conflict-3",
    surface: "web",
    email: "student@example.test",
    universityId: "univ-2",
    now: NOW,
    ttlMs: TTL_MS,
  });

  assert.deepEqual(diffUnivResult, { accepted: false });
  assert.deepEqual(harnessUnivDiff.inserts, []);
  assert.deepEqual(harnessUnivDiff.updates, []);
});

type MemoryDatabaseOptions = {
  selectedRows?: unknown[][];
  insertResults?: unknown[][];
  deleteResults?: unknown[][];
  updateResults?: unknown[][];
};

function createMemoryDatabase({
  selectedRows = [],
  insertResults = [],
  deleteResults = [],
  updateResults = [],
}: MemoryDatabaseOptions = {}) {
  const selects: Array<{ table?: unknown; condition?: unknown }> = [];
  const updates: Array<{ table: unknown; values?: Record<string, unknown>; condition?: unknown }> = [];
  const inserts: Array<{ table: unknown; values?: Record<string, unknown>; conflictTarget?: unknown }> = [];
  const deletes: Array<{ table: unknown; condition?: unknown; returning?: unknown }> = [];
  let transactionCount = 0;

  const buildSelect = () => {
    const record: { table?: unknown; condition?: unknown } = {};
    selects.push(record);
    const query = {
      from: (table: unknown) => {
        record.table = table;
        return query;
      },
      where: (condition: unknown) => {
        record.condition = condition;
        return query;
      },
      limit: async () => selectedRows.shift() ?? [],
    };
    return query;
  };

  const buildDelete = (table: unknown) => {
    const record: { table: unknown; condition?: unknown; returning?: unknown } = { table };
    deletes.push(record);
    const chain = {
      where: (condition: unknown) => {
        record.condition = condition;
        return chain;
      },
      returning: async (fields: unknown) => {
        record.returning = fields;
        return deleteResults.shift() ?? [];
      },
      then: (
        onFulfilled?: ((value: unknown) => unknown) | null,
        onRejected?: ((reason: unknown) => unknown) | null,
      ) => Promise.resolve(undefined).then(onFulfilled, onRejected),
    };
    return chain;
  };

  const buildUpdate = (table: unknown) => {
    const record: { table: unknown; values?: Record<string, unknown>; condition?: unknown } = { table };
    const chain = {
      set: (values: Record<string, unknown>) => {
        record.values = values;
        return chain;
      },
      where: (condition: unknown) => {
        record.condition = condition;
        updates.push(record);
        return chain;
      },
      returning: async () => updateResults.shift() ?? [],
      then: (
        onFulfilled?: ((value: unknown) => unknown) | null,
        onRejected?: ((reason: unknown) => unknown) | null,
      ) => Promise.resolve(undefined).then(onFulfilled, onRejected),
    };
    return chain;
  };

  const buildInsert = (table: unknown) => {
    const record: { table: unknown; values?: Record<string, unknown>; conflictTarget?: unknown } = { table };
    const chain = {
      values: (values: Record<string, unknown>) => {
        record.values = values;
        return chain;
      },
      onConflictDoNothing: (opts?: { target?: unknown }) => {
        record.conflictTarget = opts?.target;
        return chain;
      },
      returning: async () => {
        inserts.push(record);
        return insertResults.shift() ?? [];
      },
      then: (
        onFulfilled?: ((value: unknown) => unknown) | null,
        onRejected?: ((reason: unknown) => unknown) | null,
      ) => {
        inserts.push(record);
        return Promise.resolve(undefined).then(onFulfilled, onRejected);
      },
    };
    return chain;
  };

  const tx = {
    select: buildSelect,
    delete: buildDelete,
    update: buildUpdate,
    insert: buildInsert,
  };

  const database = {
    select: buildSelect,
    delete: buildDelete,
    update: buildUpdate,
    insert: buildInsert,
    transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => {
      transactionCount++;
      return callback(tx);
    },
  };

  return {
    database: database as never,
    selects,
    updates,
    inserts,
    deletes,
    get transactionCount() {
      return transactionCount;
    },
  };
}

test("drizzle repository: record inserts new context when no existing row found", async () => {
  const fake = createMemoryDatabase({
    selectedRows: [[]],
    insertResults: [[{ id: "new-ctx-1" }]],
  });
  const repository = createAdminGoogleAuthContextDrizzleRepository(fake.database);
  const service = createAdminGoogleAuthContextService({ repository });

  const result = await service.recordGoogleAuthContext({
    providerAccountId: "google-acc-1",
    surface: "web",
    email: "student@example.test",
    universityId: "univ-1",
    now: NOW,
    ttlMs: TTL_MS,
  });

  assert.deepEqual(result, { accepted: true });
  assert.equal(fake.inserts.length, 1);
  assert.deepEqual(fake.updates, []);
  assert.equal(fake.transactionCount, 1);
});

test("drizzle repository: record updates timestamps when existing row has matching context", async () => {
  const fake = createMemoryDatabase({
    selectedRows: [[{ id: "ctx-1", email: "student@example.test", universityId: "univ-1" }]],
  });
  const repository = createAdminGoogleAuthContextDrizzleRepository(fake.database);
  const service = createAdminGoogleAuthContextService({ repository });

  const result = await service.recordGoogleAuthContext({
    providerAccountId: "google-acc-1",
    surface: "web",
    email: "student@example.test",
    universityId: "univ-1",
    now: NOW,
    ttlMs: TTL_MS,
  });

  assert.deepEqual(result, { accepted: true });
  assert.deepEqual(fake.inserts, []);
  assert.equal(fake.updates.length, 1);
  assert.deepEqual(fake.updates[0].values, {
    at: NOW,
    expiresAt: new Date(NOW.getTime() + TTL_MS),
  });
});

test("drizzle repository: record rejects and performs no writes when existing row has different email", async () => {
  const fake = createMemoryDatabase({
    selectedRows: [[{ id: "ctx-1", email: "student@example.test", universityId: "univ-1" }]],
  });
  const repository = createAdminGoogleAuthContextDrizzleRepository(fake.database);
  const service = createAdminGoogleAuthContextService({ repository });

  const result = await service.recordGoogleAuthContext({
    providerAccountId: "google-acc-1",
    surface: "web",
    email: "different@example.test",
    universityId: "univ-1",
    now: NOW,
    ttlMs: TTL_MS,
  });

  assert.deepEqual(result, { accepted: false });
  assert.deepEqual(fake.inserts, []);
  assert.deepEqual(fake.updates, []);
});

test("drizzle repository: record rejects and performs no writes when existing row has different universityId", async () => {
  const fake = createMemoryDatabase({
    selectedRows: [[{ id: "ctx-1", email: "student@example.test", universityId: "univ-1" }]],
  });
  const repository = createAdminGoogleAuthContextDrizzleRepository(fake.database);
  const service = createAdminGoogleAuthContextService({ repository });

  const result = await service.recordGoogleAuthContext({
    providerAccountId: "google-acc-1",
    surface: "web",
    email: "student@example.test",
    universityId: "univ-2",
    now: NOW,
    ttlMs: TTL_MS,
  });

  assert.deepEqual(result, { accepted: false });
  assert.deepEqual(fake.inserts, []);
  assert.deepEqual(fake.updates, []);
});

test("drizzle repository: record accepts admin surface with null universityId on both sides", async () => {
  const fake = createMemoryDatabase({
    selectedRows: [[{ id: "ctx-admin-1", email: "admin@example.test", universityId: null }]],
  });
  const repository = createAdminGoogleAuthContextDrizzleRepository(fake.database);
  const service = createAdminGoogleAuthContextService({ repository });

  const result = await service.recordGoogleAuthContext({
    providerAccountId: "google-admin-1",
    surface: "admin",
    email: "admin@example.test",
    universityId: null,
    now: NOW,
    ttlMs: TTL_MS,
  });

  assert.deepEqual(result, { accepted: true });
  assert.deepEqual(fake.inserts, []);
  assert.equal(fake.updates.length, 1);
});

test("drizzle repository: record handles insert conflict and updates when reloaded row matches context", async () => {
  const fake = createMemoryDatabase({
    selectedRows: [
      [],
      [{ id: "conflict-ctx-1", email: "student@example.test", universityId: "univ-1" }],
    ],
    insertResults: [[]],
  });
  const repository = createAdminGoogleAuthContextDrizzleRepository(fake.database);
  const service = createAdminGoogleAuthContextService({ repository });

  const result = await service.recordGoogleAuthContext({
    providerAccountId: "google-conflict-1",
    surface: "web",
    email: "student@example.test",
    universityId: "univ-1",
    now: NOW,
    ttlMs: TTL_MS,
  });

  assert.deepEqual(result, { accepted: true });
  assert.equal(fake.inserts.length, 1);
  assert.equal(fake.updates.length, 1);
  assert.deepEqual(fake.updates[0].values, {
    at: NOW,
    expiresAt: new Date(NOW.getTime() + TTL_MS),
  });
});

test("drizzle repository: record handles insert conflict and rejects without update when reloaded row differs", async () => {
  const fakeEmailDiff = createMemoryDatabase({
    selectedRows: [
      [],
      [{ id: "conflict-ctx-2", email: "original@example.test", universityId: "univ-1" }],
    ],
    insertResults: [[]],
  });
  const repoEmailDiff = createAdminGoogleAuthContextDrizzleRepository(fakeEmailDiff.database);
  const serviceEmailDiff = createAdminGoogleAuthContextService({ repository: repoEmailDiff });

  const resultEmailDiff = await serviceEmailDiff.recordGoogleAuthContext({
    providerAccountId: "google-conflict-2",
    surface: "web",
    email: "different@example.test",
    universityId: "univ-1",
    now: NOW,
    ttlMs: TTL_MS,
  });

  assert.deepEqual(resultEmailDiff, { accepted: false });
  assert.deepEqual(fakeEmailDiff.updates, []);

  const fakeUnivDiff = createMemoryDatabase({
    selectedRows: [
      [],
      [{ id: "conflict-ctx-3", email: "student@example.test", universityId: "univ-1" }],
    ],
    insertResults: [[]],
  });
  const repoUnivDiff = createAdminGoogleAuthContextDrizzleRepository(fakeUnivDiff.database);
  const serviceUnivDiff = createAdminGoogleAuthContextService({ repository: repoUnivDiff });

  const resultUnivDiff = await serviceUnivDiff.recordGoogleAuthContext({
    providerAccountId: "google-conflict-3",
    surface: "web",
    email: "student@example.test",
    universityId: "univ-2",
    now: NOW,
    ttlMs: TTL_MS,
  });

  assert.deepEqual(resultUnivDiff, { accepted: false });
  assert.deepEqual(fakeUnivDiff.updates, []);
});

test("drizzle repository: record handles insert conflict and rejects when reloaded row is empty", async () => {
  const fake = createMemoryDatabase({
    selectedRows: [[], []],
    insertResults: [[]],
  });
  const repository = createAdminGoogleAuthContextDrizzleRepository(fake.database);
  const service = createAdminGoogleAuthContextService({ repository });

  const result = await service.recordGoogleAuthContext({
    providerAccountId: "google-conflict-4",
    surface: "web",
    email: "student@example.test",
    universityId: "univ-1",
    now: NOW,
    ttlMs: TTL_MS,
  });

  assert.deepEqual(result, { accepted: false });
  assert.deepEqual(fake.updates, []);
});

test("drizzle repository: consume deletes and returns context once, then returns null on second call", async () => {
  const fake = createMemoryDatabase({
    deleteResults: [
      [{ email: "student@example.test", universityId: "univ-1", at: NOW }],
      [],
    ],
  });
  const repository = createAdminGoogleAuthContextDrizzleRepository(fake.database);
  const service = createAdminGoogleAuthContextService({ repository });

  const first = await service.consumeGoogleAuthContext({
    providerAccountId: "google-acc-1",
    surface: "web",
    now: NOW,
  });
  assert.deepEqual(first, {
    email: "student@example.test",
    universityId: "univ-1",
    at: NOW,
  });

  const second = await service.consumeGoogleAuthContext({
    providerAccountId: "google-acc-1",
    surface: "web",
    now: NOW,
  });
  assert.equal(second, null);
});
