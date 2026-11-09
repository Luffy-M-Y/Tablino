import assert from "node:assert/strict";
import test from "node:test";
import {
  completeUniversityPartnership,
  getUniversityPartnershipInfo,
} from "../src/university-partnership";

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

type InsertChain = {
  values: (values: Record<string, unknown>) => InsertChain;
  onConflictDoUpdate: (config: { target: unknown; set: Record<string, unknown> }) => Promise<unknown>;
};

function createMemoryDatabase({
  selectedRows = [],
  updateResults = [],
  insertError,
}: {
  selectedRows?: unknown[][];
  updateResults?: unknown[][];
  insertError?: Error;
} = {}) {
  const selects: Array<{ table?: unknown; condition?: unknown; lock?: "update" }> = [];
  const updates: Array<{ table?: unknown; values?: Record<string, unknown>; condition?: unknown }> = [];
  const inserts: Array<{ table?: unknown; values?: Record<string, unknown>; conflictSet?: Record<string, unknown> }> = [];
  const committedUpdates: typeof updates = [];
  const committedInserts: typeof inserts = [];
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
    insert: (table: unknown) => {
      const record: { table?: unknown; values?: Record<string, unknown>; conflictSet?: Record<string, unknown> } = { table };
      inserts.push(record);
      const chain: InsertChain = {
        values: (values) => {
          record.values = values;
          return chain;
        },
        onConflictDoUpdate: async (config) => {
          if (insertError) throw insertError;
          record.conflictSet = config.set;
          return [record.values];
        },
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
        const insertStart = inserts.length;
        const result = await callback(tx);
        committedUpdates.push(...updates.slice(updateStart));
        committedInserts.push(...inserts.slice(insertStart));
        return result;
      },
    } as never,
    selects,
    updates,
    inserts,
    committedUpdates,
    committedInserts,
    get transactionCount() {
      return transactionCount;
    },
  };
}

test("getUniversityPartnershipInfo returns info for existing university", async () => {
  const fake = createMemoryDatabase({
    selectedRows: [
      [{ name: "Université Joseph Ki-Zerbo", acronym: null, status: "approved", revenueShareBps: 3000 }],
    ],
  });

  const result = await getUniversityPartnershipInfo("u-1", fake.database);
  assert.deepEqual(result, {
    name: "Université Joseph Ki-Zerbo",
    acronym: null,
    status: "approved",
    revenueShareBps: 3000,
  });
});

test("getUniversityPartnershipInfo returns null when university is not found or id invalid", async () => {
  const fake = createMemoryDatabase({
    selectedRows: [[]],
  });

  const notFound = await getUniversityPartnershipInfo("u-unknown", fake.database);
  assert.equal(notFound, null);

  const emptyId = await getUniversityPartnershipInfo("   ", fake.database);
  assert.equal(emptyId, null);
});

test("completeUniversityPartnership validates input strictly", async () => {
  const fake = createMemoryDatabase();

  const invalidInputs = [
    { userId: "user-1", universityId: "", acronym: "ISCOM", operator: "Orange Money", holderName: "Jean Dupont", numberEncrypted: "v1:enc", contractVersion: "v1" },
    { userId: "user-1", universityId: "u-1", acronym: "", operator: "Orange Money", holderName: "Jean Dupont", numberEncrypted: "v1:enc", contractVersion: "v1" },
    { userId: "user-1", universityId: "u-1", acronym: "A".repeat(21), operator: "Orange Money", holderName: "Jean Dupont", numberEncrypted: "v1:enc", contractVersion: "v1" },
    { userId: "user-1", universityId: "u-1", acronym: "ISCOM", operator: "", holderName: "Jean Dupont", numberEncrypted: "v1:enc", contractVersion: "v1" },
    { userId: "user-1", universityId: "u-1", acronym: "ISCOM", operator: "Orange Money", holderName: " ", numberEncrypted: "v1:enc", contractVersion: "v1" },
    { userId: "user-1", universityId: "u-1", acronym: "ISCOM", operator: "Orange Money", holderName: "Jean", numberEncrypted: "", contractVersion: "v1" },
    { userId: "user-1", universityId: "u-1", acronym: "ISCOM", operator: "Orange Money", holderName: "Jean", numberEncrypted: "v1:enc", contractVersion: " " },
  ];

  for (const input of invalidInputs) {
    const res = await completeUniversityPartnership(input, fake.database);
    assert.deepEqual(res, { ok: false, reason: "invalid_input" });
  }

  assert.equal(fake.transactionCount, 0);
});

test("completeUniversityPartnership returns not_approved when update returns 0 rows (no upsert)", async () => {
  const fake = createMemoryDatabase({
    selectedRows: [[{ id: "user-1" }], []],
  });

  const res = await completeUniversityPartnership(
    {
      userId: "user-1",
      universityId: "u-not-approved",
      acronym: "ISCOM",
      operator: "Orange Money",
      holderName: "Agent Comptable",
      numberEncrypted: "v1:enc",
      contractVersion: "v1",
    },
    fake.database,
  );

  assert.deepEqual(res, { ok: false, reason: "not_approved" });
  assert.equal(fake.transactionCount, 1);
  assert.equal(fake.updates.length, 0);
  assert.equal(fake.inserts.length, 0);
});

test("completeUniversityPartnership activates university and upserts payout details in one transaction", async () => {
  const now = new Date("2026-11-03T12:00:00.000Z");
  const fake = createMemoryDatabase({
    selectedRows: [
      [{ id: "user-approved" }],
      [{ id: "u-approved", status: "approved", revenueShareBps: 3500 }],
      [],
      [],
    ],
    updateResults: [[{ revenueShareBps: 3500 }]],
  });

  const res = await completeUniversityPartnership(
    {
      userId: "user-approved",
      universityId: "u-approved",
      acronym: "ISCOM",
      operator: "Moov Money",
      holderName: "Université Joseph Ki-Zerbo",
      numberEncrypted: "v1:iv:tag:cipher",
      contractVersion: "v1",
    },
    fake.database,
    now,
  );

  assert.deepEqual(res, { ok: true, acceptedShareBps: 3500 });
  assert.equal(fake.transactionCount, 1);
  assert.equal(fake.updates.length, 1);
  assert.deepEqual(fake.updates[0].values, {
    acronym: "ISCOM",
    slug: "iscom",
    status: "active",
  });

  assert.equal(fake.inserts.length, 1);
  assert.deepEqual(fake.inserts[0].values, {
    universityId: "u-approved",
    mobileMoneyOperator: "Moov Money",
    mobileMoneyHolderName: "Université Joseph Ki-Zerbo",
    mobileMoneyNumberEncrypted: "v1:iv:tag:cipher",
    contractVersion: "v1",
    contractAcceptedAt: now,
    acceptedShareBps: 3500,
    createdAt: now,
    updatedAt: now,
  });
  assert.deepEqual(fake.inserts[0].conflictSet, {
    mobileMoneyOperator: "Moov Money",
    mobileMoneyHolderName: "Université Joseph Ki-Zerbo",
    mobileMoneyNumberEncrypted: "v1:iv:tag:cipher",
    contractVersion: "v1",
    contractAcceptedAt: now,
    acceptedShareBps: 3500,
    updatedAt: now,
  });
  assert.equal(fake.committedUpdates.length, 1);
  assert.equal(fake.committedInserts.length, 1);
  assert.equal(fake.selects[1].lock, "update");
});

test("completeUniversityPartnership rejects an invalid acronym before starting a transaction", async () => {
  const fake = createMemoryDatabase();

  const result = await completeUniversityPartnership({
    userId: "user-approved",
    universityId: "u-approved",
    acronym: "IS_COM",
    operator: "Moov Money",
    holderName: "Titulaire",
    numberEncrypted: "v1:enc",
    contractVersion: "v1",
  }, fake.database);

  assert.deepEqual(result, { ok: false, reason: "invalid_input" });
  assert.equal(fake.transactionCount, 0);
});

test("completeUniversityPartnership refuses a slug collision before writing", async () => {
  const fake = createMemoryDatabase({
    selectedRows: [
      [{ id: "user-approved" }],
      [{ id: "u-approved", status: "approved", revenueShareBps: 3000 }],
      [],
      [{ id: "u-other" }],
    ],
  });

  const result = await completeUniversityPartnership({
    userId: "user-approved",
    universityId: "u-approved",
    acronym: "ISCOM",
    operator: "Moov Money",
    holderName: "Titulaire",
    numberEncrypted: "v1:enc",
    contractVersion: "v1",
  }, fake.database);

  assert.deepEqual(result, { ok: false, reason: "slug_taken" });
  assert.equal(fake.updates.length, 0);
  assert.equal(fake.inserts.length, 0);
});

test("completeUniversityPartnership does not change a previously accepted contract", async () => {
  const fake = createMemoryDatabase({
    selectedRows: [
      [{ id: "user-approved" }],
      [{ id: "u-approved", status: "approved", revenueShareBps: 3000 }],
      [{ contractAcceptedAt: new Date("2026-01-01T00:00:00.000Z") }],
    ],
  });

  const result = await completeUniversityPartnership({
    userId: "user-approved",
    universityId: "u-approved",
    acronym: "OTHER",
    operator: "Moov Money",
    holderName: "Titulaire",
    numberEncrypted: "v1:enc",
    contractVersion: "v2",
  }, fake.database);

  assert.deepEqual(result, { ok: false, reason: "already_completed" });
  assert.equal(fake.updates.length, 0);
  assert.equal(fake.inserts.length, 0);
});

test("completeUniversityPartnership reports a unique constraint race and rolls back writes", async () => {
  const fake = createMemoryDatabase({
    selectedRows: [
      [{ id: "user-approved" }],
      [{ id: "u-approved", status: "approved", revenueShareBps: 3000 }],
      [],
      [],
    ],
    updateResults: [[{ revenueShareBps: 3000 }]],
    insertError: Object.assign(new Error("unique violation"), {
      code: "23505",
      constraint: "universities_slug_unique",
    }),
  });

  const result = await completeUniversityPartnership({
    userId: "user-approved",
    universityId: "u-approved",
    acronym: "ISCOM",
    operator: "Moov Money",
    holderName: "Titulaire",
    numberEncrypted: "v1:enc",
    contractVersion: "v1",
  }, fake.database);

  assert.deepEqual(result, { ok: false, reason: "slug_taken" });
  assert.equal(fake.updates.length, 1);
  assert.equal(fake.inserts.length, 1);
  assert.equal(fake.committedUpdates.length, 0);
  assert.equal(fake.committedInserts.length, 0);
});

test("completeUniversityPartnership refuses a university outside the session university scope", async () => {
  const fake = createMemoryDatabase({
    selectedRows: [[]],
  });

  const result = await completeUniversityPartnership({
    userId: "user-a",
    universityId: "u-from-another-account",
    acronym: "ISCOM",
    operator: "Moov Money",
    holderName: "Titulaire",
    numberEncrypted: "v1:enc",
    contractVersion: "v1",
  }, fake.database);

  assert.deepEqual(result, { ok: false, reason: "not_authorized" });
  assert.equal(fake.updates.length, 0);
  assert.equal(fake.inserts.length, 0);
});
