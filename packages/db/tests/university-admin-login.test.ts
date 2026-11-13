import assert from "node:assert/strict";
import test from "node:test";
import {
  authenticateAdminPassword,
  authenticateUniversityAdmin,
} from "../src/university-admin-login";
import { hashPassword } from "../src/password";
import * as schema from "../src/schema";

type SelectQuery = {
  from: (table: unknown) => SelectQuery;
  where: (condition: unknown) => SelectQuery;
  limit: (count: number) => Promise<unknown[]>;
};

function createMemoryDatabase(selectedRows: unknown[][] = []) {
  const selectedTables: unknown[] = [];

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
  };

  return { database: database as never, selectedTables };
}

const validPassword = "secure password";

function universityAdminRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "university-admin-id",
    role: "university_admin",
    passwordHash: hashPassword(validPassword),
    revokedAt: null,
    emailVerified: new Date("2026-10-01T00:00:00.000Z"),
    ...overrides,
  };
}

test("authenticateUniversityAdmin rejects input with non-string email or password", async () => {
  const fake = createMemoryDatabase();

  assert.deepEqual(
    await authenticateUniversityAdmin({ email: 123, password: validPassword }, fake.database),
    { ok: false, reason: "invalid_credentials" },
  );
  assert.deepEqual(
    await authenticateUniversityAdmin({ email: "admin@example.com", password: null }, fake.database),
    { ok: false, reason: "invalid_credentials" },
  );
  assert.deepEqual(fake.selectedTables, []);
});

test("authenticateUniversityAdmin rejects an unknown email", async () => {
  const fake = createMemoryDatabase([[]]);

  assert.deepEqual(
    await authenticateUniversityAdmin(
      { email: " ADMIN@EXAMPLE.COM ", password: validPassword },
      fake.database,
    ),
    { ok: false, reason: "invalid_credentials" },
  );
  assert.deepEqual(fake.selectedTables, [schema.users]);
});

test("authenticateUniversityAdmin rejects an incorrect password", async () => {
  const fake = createMemoryDatabase([[universityAdminRow()]]);

  assert.deepEqual(
    await authenticateUniversityAdmin(
      { email: "admin@example.com", password: "incorrect password" },
      fake.database,
    ),
    { ok: false, reason: "invalid_credentials" },
  );
});

test("authenticateUniversityAdmin rejects a student with a matching password", async () => {
  const fake = createMemoryDatabase([[universityAdminRow({ role: "student" })]]);

  assert.deepEqual(
    await authenticateUniversityAdmin(
      { email: "admin@example.com", password: validPassword },
      fake.database,
    ),
    { ok: false, reason: "invalid_credentials" },
  );
});

test("authenticateUniversityAdmin rejects a null password hash", async () => {
  const fake = createMemoryDatabase([[universityAdminRow({ passwordHash: null })]]);

  assert.deepEqual(
    await authenticateUniversityAdmin(
      { email: "admin@example.com", password: validPassword },
      fake.database,
    ),
    { ok: false, reason: "invalid_credentials" },
  );
});

test("authenticateUniversityAdmin reports an unverified email after valid credentials", async () => {
  const fake = createMemoryDatabase([[universityAdminRow({ emailVerified: null })]]);

  assert.deepEqual(
    await authenticateUniversityAdmin(
      { email: "admin@example.com", password: validPassword },
      fake.database,
    ),
    { ok: false, reason: "email_not_verified", userId: "university-admin-id" },
  );
});

test("authenticateUniversityAdmin accepts a verified university admin", async () => {
  const fake = createMemoryDatabase([[universityAdminRow()]]);

  assert.deepEqual(
    await authenticateUniversityAdmin(
      { email: " ADMIN@EXAMPLE.COM ", password: validPassword },
      fake.database,
    ),
    { ok: true, userId: "university-admin-id" },
  );
});

test("authenticateAdminPassword accepts a verified super admin with a password hash", async () => {
  const fake = createMemoryDatabase([[
    universityAdminRow({
      id: "super-admin-id",
      role: "super_admin",
      passwordHash: hashPassword(validPassword),
    }),
  ]]);

  assert.deepEqual(
    await authenticateAdminPassword(
      { email: " ADMIN@EXAMPLE.COM ", password: validPassword },
      fake.database,
    ),
    { ok: true, userId: "super-admin-id", role: "super_admin" },
  );
});

test("authenticateAdminPassword reports unverified super-admin credentials", async () => {
  const fake = createMemoryDatabase([[
    universityAdminRow({
      id: "super-admin-id",
      role: "super_admin",
      passwordHash: hashPassword(validPassword),
      emailVerified: null,
    }),
  ]]);

  assert.deepEqual(
    await authenticateAdminPassword(
      { email: "admin@example.com", password: validPassword },
      fake.database,
    ),
    {
      ok: false,
      reason: "email_not_verified",
      userId: "super-admin-id",
      role: "super_admin",
    },
  );
});

test("authenticateUniversityAdmin still rejects a super admin", async () => {
  const fake = createMemoryDatabase([[
    universityAdminRow({
      role: "super_admin",
      passwordHash: hashPassword(validPassword),
    }),
  ]]);

  assert.deepEqual(
    await authenticateUniversityAdmin(
      { email: "admin@example.com", password: validPassword },
      fake.database,
    ),
    { ok: false, reason: "invalid_credentials" },
  );
});
