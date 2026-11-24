import assert from "node:assert/strict";
import test from "node:test";
import { registerUniversityAdminWithPassword } from "../src/university-password-signup";
import { verifyPassword } from "../src/password";
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

type InsertChain = {
  values: (values: Record<string, unknown>) => InsertChain;
  onConflictDoNothing: (conflict: { target: unknown }) => InsertChain;
  returning: (selection: Record<string, unknown>) => Promise<unknown[]>;
};

function createMemoryDatabase({
  selectedRows = [],
  insertResults = [],
}: {
  selectedRows?: unknown[][];
  insertResults?: unknown[][];
} = {}) {
  const inserts: InsertRecord[] = [];
  let transactionCount = 0;

  const tx = {
    select: () => {
      const query: SelectQuery = {
        from: () => query,
        where: () => query,
        limit: async () => selectedRows.shift() ?? [],
        then: (onFulfilled, onRejected) =>
          Promise.resolve(selectedRows.shift() ?? []).then(onFulfilled, onRejected),
      };
      return query;
    },
    insert: (table: unknown) => {
      const record: InsertRecord = { table };
      const chain: InsertChain = {
        values: (values) => {
          record.values = values;
          inserts.push(record);
          return chain;
        },
        onConflictDoNothing: () => chain,
        returning: async () => insertResults.shift() ?? [],
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
    get transactionCount() {
      return transactionCount;
    },
  };
}

const validInput = {
  universityName: "  Université Exemple  ",
  acronym: " UEX ",
  phone: " +225 0102030405 ",
  email: " ADMIN@EXAMPLE.COM ",
  name: " Ada Lovelace ",
  password: "secure password",
};

test("registerUniversityAdminWithPassword creates a pending university and admin", async () => {
  const now = new Date("2026-10-31T09:00:00.000Z");
  const fake = createMemoryDatabase({
    selectedRows: [[]],
    insertResults: [[{ id: "university-id" }], [{ id: "user-id" }]],
  });

  assert.deepEqual(
    await registerUniversityAdminWithPassword(validInput, fake.database, now),
    { ok: true, universityId: "university-id", userId: "user-id" },
  );
  assert.equal(fake.transactionCount, 1);
  assert.deepEqual(fake.inserts.map((insert) => insert.table), [schema.universities, schema.users]);
  assert.equal(fake.inserts[0].values?.name, "Université Exemple");
  assert.equal(fake.inserts[0].values?.acronym, "UEX");
  assert.equal(fake.inserts[0].values?.phone, "+225 0102030405");
  assert.equal(fake.inserts[0].values?.status, "pending");
  assert.equal(fake.inserts[0].values?.revenueShareBps, 0);
  assert.match(String(fake.inserts[0].values?.slug), /^u-[a-f0-9]{12}$/);
  assert.equal(fake.inserts[0].values?.locality, null);
  assert.equal(fake.inserts[0].values?.visibility, "private");
  assert.ok(String(fake.inserts[0].values?.slug).length <= 100);
  assert.equal(fake.inserts[1].values?.name, "Ada Lovelace");
  assert.equal(fake.inserts[1].values?.email, "admin@example.com");
  assert.equal(fake.inserts[1].values?.role, "university_admin");
  assert.equal(fake.inserts[1].values?.universityId, "university-id");
  assert.equal(fake.inserts[1].values?.emailVerified, null);
});

test("registerUniversityAdminWithPassword rejects an existing email", async () => {
  const fake = createMemoryDatabase({ selectedRows: [[{ id: "existing-user" }]] });

  assert.deepEqual(
    await registerUniversityAdminWithPassword(validInput, fake.database),
    { ok: false, reason: "email_taken" },
  );
  assert.deepEqual(fake.inserts, []);
});

test("registerUniversityAdminWithPassword rejects an invalid password before opening a transaction", async () => {
  const fake = createMemoryDatabase();

  assert.deepEqual(
    await registerUniversityAdminWithPassword(
      { ...validInput, password: "short" },
      fake.database,
    ),
    { ok: false, reason: "invalid_input" },
  );
  assert.equal(fake.transactionCount, 0);
});

test("registerUniversityAdminWithPassword stores a verifiable password hash", async () => {
  const fake = createMemoryDatabase({
    selectedRows: [[]],
    insertResults: [[{ id: "university-id" }], [{ id: "user-id" }]],
  });

  await registerUniversityAdminWithPassword(validInput, fake.database);

  const passwordHash = String(fake.inserts[1].values?.passwordHash);
  assert.match(passwordHash, /^scrypt\$/);
  assert.equal(verifyPassword(validInput.password, passwordHash), true);
});

test("registerUniversityAdminWithPassword leaves the admin email unverified", async () => {
  const fake = createMemoryDatabase({
    selectedRows: [[]],
    insertResults: [[{ id: "university-id" }], [{ id: "user-id" }]],
  });

  await registerUniversityAdminWithPassword(validInput, fake.database);

  assert.equal(fake.inserts[1].values?.emailVerified, null);
});

test("registerUniversityAdminWithPassword stores the locality and the chosen visibility", async () => {
  const fake = createMemoryDatabase({
    selectedRows: [[], []],
    insertResults: [[{ id: "university-id" }], [{ id: "user-id" }]],
  });

  assert.deepEqual(
    await registerUniversityAdminWithPassword(
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

test("registerUniversityAdminWithPassword rejects an invalid address before opening a transaction", async () => {
  const invalidInputs = [
    { ...validInput, acronym: null as never },
    { ...validInput, acronym: "" },
    { ...validInput, acronym: "   " },
    { ...validInput, acronym: "a".repeat(21) },
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
      await registerUniversityAdminWithPassword(input, fake.database),
      { ok: false, reason: "invalid_input" },
    );
    assert.equal(fake.transactionCount, 0);
  }
});

test("registerUniversityAdminWithPassword requires a locality when the acronym is already used", async () => {
  const fake = createMemoryDatabase({
    selectedRows: [[], [{ acronym: "UEX", locality: null, slug: "uex", status: "active" }]],
  });

  assert.deepEqual(
    await registerUniversityAdminWithPassword(validInput, fake.database),
    { ok: false, reason: "locality_required" },
  );
  assert.deepEqual(fake.inserts, []);
});

test("registerUniversityAdminWithPassword refuses an acronym and locality already used", async () => {
  const fake = createMemoryDatabase({
    selectedRows: [[], [{ acronym: "UEX", locality: "Bobo", slug: "u-0a1b2c3d4e5f", status: "approved" }]],
  });

  assert.deepEqual(
    await registerUniversityAdminWithPassword({ ...validInput, locality: "bobo" }, fake.database),
    { ok: false, reason: "address_taken" },
  );
  assert.deepEqual(fake.inserts, []);
});

test("registerUniversityAdminWithPassword ignores a pending university with the same acronym", async () => {
  const fake = createMemoryDatabase({
    selectedRows: [[], [{ acronym: "UEX", locality: null, slug: "u-0a1b2c3d4e5f", status: "pending" }]],
    insertResults: [[{ id: "university-id" }], [{ id: "user-id" }]],
  });

  assert.deepEqual(
    await registerUniversityAdminWithPassword(validInput, fake.database),
    { ok: true, universityId: "university-id", userId: "user-id" },
  );
});
