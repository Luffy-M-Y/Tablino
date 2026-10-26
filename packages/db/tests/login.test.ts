import assert from "node:assert/strict";
import test from "node:test";
import { authenticateStudent, createStudentSession, SESSION_MAX_AGE_DAYS } from "../src/login";
import { hashPassword } from "../src/password";
import * as schema from "../src/schema";

type SelectQuery = {
  from: (table: unknown) => SelectQuery;
  where: (condition: unknown) => SelectQuery;
  limit: (count: number) => Promise<unknown[]>;
};

type InsertRecord = {
  table: unknown;
  values?: Record<string, unknown>;
};

function createMemoryDatabase(selectedRows: unknown[][] = []) {
  const selectedTables: unknown[] = [];
  const inserts: InsertRecord[] = [];

  const database = {
    select: () => {
      const query: SelectQuery = {
        from: (table) => {
          selectedTables.push(table);
          return query;
        },
        where: () => query,
        limit: async () => selectedRows.shift() ?? [],
      };
      return query;
    },
    insert: (table: unknown) => ({
      values: async (values: Record<string, unknown>) => {
        inserts.push({ table, values });
      },
    }),
  };

  return { database: database as never, selectedTables, inserts };
}

const validPassword = "secure password";
const universityId = "university-id";

function studentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "student-id",
    universityId,
    role: "student",
    passwordHash: hashPassword(validPassword),
    revokedAt: null,
    ...overrides,
  };
}

test("authenticateStudent accepts a matching student account", async () => {
  const fake = createMemoryDatabase([[studentRow()]]);

  assert.deepEqual(
    await authenticateStudent(universityId, { email: " STUDENT@EXAMPLE.COM ", password: validPassword }, fake.database),
    { ok: true, userId: "student-id" },
  );
  assert.deepEqual(fake.selectedTables, [schema.users]);
});

test("authenticateStudent rejects an incorrect password", async () => {
  const fake = createMemoryDatabase([[studentRow()]]);

  assert.deepEqual(
    await authenticateStudent(universityId, { email: "student@example.com", password: "incorrect password" }, fake.database),
    { ok: false, reason: "invalid_credentials" },
  );
});

test("authenticateStudent rejects an absent email account", async () => {
  const fake = createMemoryDatabase([[]]);

  assert.deepEqual(
    await authenticateStudent(universityId, { email: "absent@example.com", password: validPassword }, fake.database),
    { ok: false, reason: "invalid_credentials" },
  );
});

test("authenticateStudent rejects an account from another university", async () => {
  const fake = createMemoryDatabase([[studentRow({ universityId: "another-university" })]]);

  assert.deepEqual(
    await authenticateStudent(universityId, { email: "student@example.com", password: validPassword }, fake.database),
    { ok: false, reason: "invalid_credentials" },
  );
});

test("authenticateStudent rejects a non-student account", async () => {
  const fake = createMemoryDatabase([[studentRow({ role: "university_admin" })]]);

  assert.deepEqual(
    await authenticateStudent(universityId, { email: "student@example.com", password: validPassword }, fake.database),
    { ok: false, reason: "invalid_credentials" },
  );
});

test("authenticateStudent rejects a null password hash after dummy verification", async () => {
  const fake = createMemoryDatabase([[studentRow({ passwordHash: null })]]);

  assert.deepEqual(
    await authenticateStudent(universityId, { email: "student@example.com", password: validPassword }, fake.database),
    { ok: false, reason: "invalid_credentials" },
  );
});

test("authenticateStudent rejects a revoked account", async () => {
  const fake = createMemoryDatabase([[studentRow({ revokedAt: new Date() })]]);

  assert.deepEqual(
    await authenticateStudent(universityId, { email: "student@example.com", password: validPassword }, fake.database),
    { ok: false, reason: "invalid_credentials" },
  );
});

test("authenticateStudent rejects invalid input", async () => {
  const fake = createMemoryDatabase();

  assert.deepEqual(
    await authenticateStudent(universityId, { email: "invalid-email", password: validPassword }, fake.database),
    { ok: false, reason: "invalid_credentials" },
  );
  assert.deepEqual(fake.selectedTables, []);
});

test("createStudentSession stores a 32-byte hexadecimal token and expires after 30 days", async () => {
  const now = new Date("2026-10-26T12:00:00.000Z");
  const fake = createMemoryDatabase();

  const result = await createStudentSession("student-id", now, fake.database);

  assert.equal(result.sessionToken.length, 64);
  assert.equal(Array.from(result.sessionToken).every((character) => "0123456789abcdef".includes(character)), true);
  assert.equal(SESSION_MAX_AGE_DAYS, 30);
  assert.equal(result.expires.getTime(), now.getTime() + 30 * 24 * 60 * 60 * 1000);
  assert.equal(fake.inserts.length, 1);
  assert.equal(fake.inserts[0].table, schema.sessions);
  assert.deepEqual(fake.inserts[0].values, {
    userId: "student-id",
    sessionToken: result.sessionToken,
    expires: result.expires,
  });
});
