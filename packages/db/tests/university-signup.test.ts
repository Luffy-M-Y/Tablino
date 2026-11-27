import assert from "node:assert/strict";
import test from "node:test";
import { registerUniversityAdminWithGoogle } from "../src/university-signup";
import * as schema from "../src/schema";

type SelectQuery = {
  from: (table: unknown) => SelectQuery;
  where: (condition: unknown) => SelectQuery;
  limit: (count: number) => Promise<unknown[]>;
  then: (
    onFulfilled?: ((value: unknown[]) => unknown) | null,
    onRejected?: ((reason: unknown) => unknown) | null,
  ) => Promise<unknown>;
};

type InsertRecord = {
  table: unknown;
  values?: Record<string, unknown>;
};

type ConflictTarget = { target: unknown };

type InsertChain = {
  values: (values: Record<string, unknown>) => InsertChain;
  onConflictDoNothing: (conflict: ConflictTarget) => InsertChain;
  returning: (selection: Record<string, unknown>) => Promise<unknown[]>;
  then: (
    onFulfilled?: ((value: unknown) => unknown) | null,
    onRejected?: ((reason: unknown) => unknown) | null,
  ) => Promise<unknown>;
};

function createMemoryDatabase({
  selectedRows = [],
  insertResults = [],
}: {
  selectedRows?: unknown[][];
  insertResults?: Array<unknown[] | Error>;
} = {}) {
  const selects: Array<{ table?: unknown; condition?: unknown }> = [];
  const inserts: InsertRecord[] = [];
  const conflicts: ConflictTarget[] = [];
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
        then: (onFulfilled, onRejected) =>
          Promise.resolve(selectedRows.shift() ?? []).then(onFulfilled, onRejected),
      };
      return query;
    },
    insert: (table: unknown) => {
      const record: InsertRecord = { table };
      inserts.push(record);
      const chain: InsertChain = {
        values: (values) => {
          record.values = values;
          return chain;
        },
        onConflictDoNothing: (conflict) => {
          conflicts.push(conflict);
          return chain;
        },
        returning: async () => {
          const result = insertResults.shift() ?? [];
          if (result instanceof Error) throw result;
          return result;
        },
        then: (onFulfilled, onRejected) => {
          const result = insertResults.shift() ?? [];
          if (result instanceof Error) return Promise.reject(result).then(onFulfilled, onRejected);
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
    inserts,
    conflicts,
    get transactionCount() {
      return transactionCount;
    },
  };
}

const validInput = {
  universityName: "  Université Exemple  ",
  acronym: " UEX ",
  email: " ADMIN@EXAMPLE.COM ",
  name: " Ada Lovelace ",
  image: " https://example.com/avatar.png ",
  providerAccountId: " google-account-id ",
};

test("registerUniversityAdminWithGoogle rejects invalid input before opening a transaction", async () => {
  for (const input of [
    { ...validInput, universityName: "!!!" },
    { ...validInput, email: "invalid-email" },
    { ...validInput, providerAccountId: "   " },
  ]) {
    const fake = createMemoryDatabase();

    assert.deepEqual(
      await registerUniversityAdminWithGoogle(input, fake.database),
      { ok: false, reason: "invalid_input" },
    );
    assert.equal(fake.transactionCount, 0);
  }
});

test("registerUniversityAdminWithGoogle rejects an existing email", async () => {
  const fake = createMemoryDatabase({ selectedRows: [[{ id: "existing-user" }]] });

  assert.deepEqual(
    await registerUniversityAdminWithGoogle(validInput, fake.database),
    { ok: false, reason: "email_taken" },
  );
  assert.deepEqual(fake.inserts, []);
});

test("registerUniversityAdminWithGoogle rejects an existing Google account", async () => {
  const fake = createMemoryDatabase({
    selectedRows: [[], [{ userId: "existing-user" }]],
  });

  assert.deepEqual(
    await registerUniversityAdminWithGoogle(validInput, fake.database),
    { ok: false, reason: "account_taken" },
  );
  assert.deepEqual(fake.inserts, []);
});

test("registerUniversityAdminWithGoogle creates the university, admin, and Google account in order", async () => {
  const now = new Date("2026-10-31T09:00:00.000Z");
  const fake = createMemoryDatabase({
    selectedRows: [[], [], []],
    insertResults: [[{ id: "university-id" }], [{ id: "user-id" }], []],
  });

  assert.deepEqual(
    await registerUniversityAdminWithGoogle(validInput, fake.database, now),
    { ok: true, universityId: "university-id", userId: "user-id" },
  );
  assert.equal(fake.transactionCount, 1);
  assert.deepEqual(fake.inserts.map((insert) => insert.table), [
    schema.universities,
    schema.users,
    schema.accounts,
  ]);
  const universityValues = fake.inserts[0].values ?? {};
  assert.equal(universityValues.name, "Université Exemple");
  assert.equal(universityValues.status, "pending");
  assert.equal(universityValues.revenueShareBps, 0);
  assert.match(String(universityValues.slug), /^u-[a-f0-9]{12}$/);
  assert.equal(universityValues.acronym, "UEX");
  assert.equal(universityValues.locality, null);
  assert.equal(universityValues.visibility, "private");
  assert.ok(String(universityValues.slug).length <= 100);
  assert.equal(fake.conflicts[0].target, schema.universities.slug);
  assert.equal(fake.inserts[1].values?.name, "Ada Lovelace");
  assert.equal(fake.inserts[1].values?.email, "admin@example.com");
  assert.equal(fake.inserts[1].values?.image, "https://example.com/avatar.png");
  assert.equal(fake.inserts[1].values?.role, "university_admin");
  assert.equal(fake.inserts[1].values?.universityId, "university-id");
  assert.equal(fake.inserts[1].values?.emailVerified, now);
  assert.deepEqual(fake.inserts[2].values, {
    userId: "user-id",
    type: "oauth",
    provider: "google",
    providerAccountId: "google-account-id",
  });
});

test("registerUniversityAdminWithGoogle retries a colliding slug", async () => {
  const fake = createMemoryDatabase({
    selectedRows: [[], [], []],
    insertResults: [[], [{ id: "university-id" }], [{ id: "user-id" }], []],
  });

  const result = await registerUniversityAdminWithGoogle(validInput, fake.database);

  assert.deepEqual(result, { ok: true, universityId: "university-id", userId: "user-id" });
  assert.equal(fake.inserts.length, 4);
  assert.notEqual(fake.inserts[0].values?.slug, fake.inserts[1].values?.slug);
});

test("registerUniversityAdminWithGoogle returns slug_unavailable after repeated slug collisions", async () => {
  const fake = createMemoryDatabase({ selectedRows: [[], [], []] });

  assert.deepEqual(
    await registerUniversityAdminWithGoogle(validInput, fake.database),
    { ok: false, reason: "slug_unavailable" },
  );
  assert.equal(fake.inserts.length, 5);
  assert.ok(fake.inserts.every((insert) => insert.table === schema.universities));
});

test("registerUniversityAdminWithGoogle maps unique constraint violations to email_taken", async () => {
  const uniqueError = Object.assign(new Error("unique constraint"), { code: "23505" });
  const fake = createMemoryDatabase({
    selectedRows: [[], [], []],
    insertResults: [[{ id: "university-id" }], [{ id: "user-id" }], uniqueError],
  });

  assert.deepEqual(
    await registerUniversityAdminWithGoogle(validInput, fake.database),
    { ok: false, reason: "email_taken" },
  );
});

test("registerUniversityAdminWithGoogle trims acronym and phone before inserting the university", async () => {
  const fake = createMemoryDatabase({
    selectedRows: [[], [], []],
    insertResults: [[{ id: "university-id" }], [{ id: "user-id" }], []],
  });

  assert.deepEqual(
    await registerUniversityAdminWithGoogle({
      ...validInput,
      acronym: "  UEX  ",
      phone: "  +225 0102030405  ",
    }, fake.database),
    { ok: true, universityId: "university-id", userId: "user-id" },
  );
  assert.equal(fake.inserts[0].values?.acronym, "UEX");
  assert.equal(fake.inserts[0].values?.phone, "+225 0102030405");
});

test("registerUniversityAdminWithGoogle inserts null for an absent or blank phone", async () => {
  for (const fields of [
    { phone: "   " },
    { phone: undefined },
  ]) {
    const fake = createMemoryDatabase({
      selectedRows: [[], [], []],
      insertResults: [[{ id: "university-id" }], [{ id: "user-id" }], []],
    });

    assert.equal((await registerUniversityAdminWithGoogle({
      ...validInput,
      ...fields,
    }, fake.database)).ok, true);
    assert.equal(fake.inserts[0].values?.acronym, "UEX");
    assert.equal(fake.inserts[0].values?.phone, null);
  }
});

test("registerUniversityAdminWithGoogle rejects oversized acronym or phone before opening a transaction", async () => {
  for (const input of [
    { ...validInput, acronym: "a".repeat(21) },
    { ...validInput, phone: "1".repeat(33) },
  ]) {
    const fake = createMemoryDatabase();

    assert.deepEqual(
      await registerUniversityAdminWithGoogle(input, fake.database),
      { ok: false, reason: "invalid_input" },
    );
    assert.equal(fake.transactionCount, 0);
  }
});

test("registerUniversityAdminWithGoogle stores the locality and the chosen visibility", async () => {
  const fake = createMemoryDatabase({
    selectedRows: [[], [], []],
    insertResults: [[{ id: "university-id" }], [{ id: "user-id" }], []],
  });

  assert.deepEqual(
    await registerUniversityAdminWithGoogle(
      { ...validInput, locality: " Ouaga ", visibility: "public" },
      fake.database,
    ),
    { ok: true, universityId: "university-id", userId: "user-id" },
  );
  assert.equal(fake.inserts[0].values?.acronym, "UEX");
  assert.equal(fake.inserts[0].values?.locality, "Ouaga");
  assert.equal(fake.inserts[0].values?.visibility, "public");
  assert.match(String(fake.inserts[0].values?.slug), /^u-[a-f0-9]{12}$/);
});

test("registerUniversityAdminWithGoogle rejects an invalid address before opening a transaction", async () => {
  const invalidInputs = [
    { ...validInput, acronym: undefined as never },
    { ...validInput, acronym: null as never },
    { ...validInput, acronym: "" },
    { ...validInput, acronym: "   " },
    { ...validInput, acronym: "www" },
    { ...validInput, acronym: "U T M" },
    { ...validInput, acronym: "U-1A2B3C4D5E6F" },
    { ...validInput, locality: "a".repeat(61) },
    { ...validInput, locality: 42 as never },
    { ...validInput, visibility: "hidden" as never },
  ];

  for (const input of invalidInputs) {
    const fake = createMemoryDatabase();
    assert.deepEqual(
      await registerUniversityAdminWithGoogle(input, fake.database),
      { ok: false, reason: "invalid_input" },
    );
    assert.equal(fake.transactionCount, 0);
  }
});

test("registerUniversityAdminWithGoogle requires a locality when the acronym is already used", async () => {
  const fake = createMemoryDatabase({
    selectedRows: [[], [], [{ acronym: "UEX", locality: null, slug: "uex", status: "active" }]],
  });

  assert.deepEqual(
    await registerUniversityAdminWithGoogle(validInput, fake.database),
    { ok: false, reason: "locality_required" },
  );
  assert.deepEqual(fake.inserts, []);
});

test("registerUniversityAdminWithGoogle refuses an acronym and locality already used", async () => {
  const fake = createMemoryDatabase({
    selectedRows: [[], [], [{ acronym: "UEX", locality: "Bobo", slug: "u-0a1b2c3d4e5f", status: "approved" }]],
  });

  assert.deepEqual(
    await registerUniversityAdminWithGoogle({ ...validInput, locality: "bobo" }, fake.database),
    { ok: false, reason: "address_taken" },
  );
  assert.deepEqual(fake.inserts, []);
});

test("registerUniversityAdminWithGoogle ignores a pending university with the same acronym", async () => {
  const fake = createMemoryDatabase({
    selectedRows: [[], [], [{ acronym: "UEX", locality: null, slug: "u-0a1b2c3d4e5f", status: "pending" }]],
    insertResults: [[{ id: "university-id" }], [{ id: "user-id" }], []],
  });

  assert.deepEqual(
    await registerUniversityAdminWithGoogle(validInput, fake.database),
    { ok: true, universityId: "university-id", userId: "user-id" },
  );
});
