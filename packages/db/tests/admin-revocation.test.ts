import assert from "node:assert/strict";
import test from "node:test";
import {
  listActiveSuperAdmins,
  createAdminRevocationStepUpVerifier,
  verifyAdminRevocationStepUp,
  revokeSuperAdminAccount,
  ADMIN_REVOCATION_AUDIT_RETENTION_MONTHS,
  type AdminRevocationStepUpVerifierDependencies,
} from "../src/admin-revocation";
import { RATE_LIMITS } from "../src/auth-attempts";
import { hashPassword } from "../src/password";

const NOW = new Date("2026-11-21T12:00:00.000Z");

type SelectQuery = {
  from: (table: unknown) => SelectQuery;
  innerJoin: (table: unknown, condition: unknown) => SelectQuery;
  where: (condition: unknown) => SelectQuery;
  orderBy: (order: unknown) => SelectQuery;
  for: (mode: unknown, options?: unknown) => SelectQuery;
  limit: (count: number) => Promise<unknown[]>;
  then: (
    onFulfilled?: ((value: unknown) => unknown) | null,
    onRejected?: ((reason: unknown) => unknown) | null,
  ) => Promise<unknown>;
};

type UpdateChain = {
  set: (values: Record<string, unknown>) => UpdateChain;
  where: (condition: unknown) => UpdateChain;
  returning: (selection?: unknown) => Promise<unknown[]>;
  then: (
    onFulfilled?: ((value: unknown) => unknown) | null,
    onRejected?: ((reason: unknown) => unknown) | null,
  ) => Promise<unknown>;
};

type InsertChain = {
  values: (values: unknown) => InsertChain;
  onConflictDoNothing: () => InsertChain;
  returning: (selection?: unknown) => Promise<unknown[]>;
  then: (
    onFulfilled?: ((value: unknown) => unknown) | null,
    onRejected?: ((reason: unknown) => unknown) | null,
  ) => Promise<unknown>;
};

type DeleteChain = {
  where: (condition: unknown) => DeleteChain;
  returning: (selection?: unknown) => Promise<unknown[]>;
  then: (
    onFulfilled?: ((value: unknown) => unknown) | null,
    onRejected?: ((reason: unknown) => unknown) | null,
  ) => Promise<unknown>;
};

function createMemoryDatabase({
  selectedRows = [],
  updateResults = [],
  insertResults = [],
  deleteResults = [],
}: {
  selectedRows?: unknown[][];
  updateResults?: unknown[][];
  insertResults?: unknown[][];
  deleteResults?: unknown[][];
} = {}) {
  const selects: Array<{ table?: unknown; condition?: unknown }> = [];
  const updates: Array<{ table?: unknown; values?: Record<string, unknown>; condition?: unknown }> = [];
  const inserts: Array<{ table?: unknown; values?: unknown }> = [];
  const deletes: Array<{ table?: unknown; condition?: unknown }> = [];
  let transactionCount = 0;

  const buildSelectQuery = (): SelectQuery => {
    const record: { table?: unknown; condition?: unknown } = {};
    selects.push(record);
    const query: SelectQuery = {
      from: (table) => {
        record.table = table;
        return query;
      },
      innerJoin: () => query,
      where: (condition) => {
        record.condition = condition;
        return query;
      },
      orderBy: () => query,
      for: () => query,
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
        then: (onFulfilled, onRejected) => {
          const result = updateResults.shift() ?? [];
          return Promise.resolve(result).then(onFulfilled, onRejected);
        },
      };
      return chain;
    },
    insert: (table: unknown) => {
      const record: { table?: unknown; values?: unknown } = { table };
      inserts.push(record);
      const chain: InsertChain = {
        values: (values) => {
          record.values = values;
          return chain;
        },
        onConflictDoNothing: () => chain,
        returning: async () => insertResults.shift() ?? [],
        then: (onFulfilled, onRejected) => {
          const result = insertResults.shift() ?? [];
          return Promise.resolve(result).then(onFulfilled, onRejected);
        },
      };
      return chain;
    },
    delete: (table: unknown) => {
      const record: { table?: unknown; condition?: unknown } = { table };
      deletes.push(record);
      const chain: DeleteChain = {
        where: (condition) => {
          record.condition = condition;
          return chain;
        },
        returning: async () => deleteResults.shift() ?? [],
        then: (onFulfilled, onRejected) => {
          const result = deleteResults.shift() ?? [];
          return Promise.resolve(result).then(onFulfilled, onRejected);
        },
      };
      return chain;
    },
  };

  return {
    database: {
      select: buildSelectQuery,
      update: tx.update,
      insert: tx.insert,
      delete: tx.delete,
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
  };
}

// ---------------------------------------------------------------------------
// 1. listActiveSuperAdmins
// ---------------------------------------------------------------------------

test("listActiveSuperAdmins returns only active super admin roles with computed hasPassword", async () => {
  const fakeRows = [
    {
      id: "u-1",
      email: "chief@tablino.test",
      role: "super_admin",
      createdAt: NOW,
      passwordHash: "scrypt$salt$hash",
    },
    {
      id: "u-2",
      email: "editor@tablino.test",
      role: "super_admin_editor",
      createdAt: NOW,
      passwordHash: null,
    },
    {
      id: "u-3",
      email: "lector@tablino.test",
      role: "super_admin_lector",
      createdAt: NOW,
      passwordHash: "scrypt$salt2$hash2",
    },
  ];

  const fake = createMemoryDatabase({ selectedRows: [fakeRows] });
  const result = await listActiveSuperAdmins(fake.database);

  assert.equal(result.length, 3);
  assert.deepEqual(result[0], {
    id: "u-1",
    email: "chief@tablino.test",
    role: "super_admin",
    createdAt: NOW,
    hasPassword: true,
  });
  assert.deepEqual(result[1], {
    id: "u-2",
    email: "editor@tablino.test",
    role: "super_admin_editor",
    createdAt: NOW,
    hasPassword: false,
  });
  assert.deepEqual(result[2], {
    id: "u-3",
    email: "lector@tablino.test",
    role: "super_admin_lector",
    createdAt: NOW,
    hasPassword: true,
  });

  // Never returns passwordHash
  for (const row of result) {
    assert.equal("passwordHash" in row, false);
  }
});

// ---------------------------------------------------------------------------
// 2. Step-up verifier tests
// ---------------------------------------------------------------------------

test("step-up verifier succeeds on correct password", async () => {
  const verify = createAdminRevocationStepUpVerifier({
    async checkRateLimit() {
      return { allowed: true };
    },
    async recordFailure() {},
    verifyPassword(password) {
      return password === "ValidPassword123!";
    },
  });

  const result = await verify("user-1", "ValidPassword123!", "stored-hash");
  assert.deepEqual(result, { ok: true });
});

test("step-up verifier fails and records failure on wrong password", async () => {
  const failures: Array<{ action: string; identifier: string }> = [];
  const verify = createAdminRevocationStepUpVerifier({
    async checkRateLimit() {
      return { allowed: true };
    },
    async recordFailure(action, identifier) {
      failures.push({ action, identifier });
    },
    verifyPassword() {
      return false;
    },
  });

  const result = await verify("user-1", "WrongPassword123!", "stored-hash");
  assert.deepEqual(result, { ok: false, reason: "invalid_password" });
  assert.equal(failures.length, 1);
  assert.equal(failures[0].identifier, "admin-revocation:user-1");
  assert.equal(failures[0].action, "login");
});

test("step-up verifier blocks at 6th attempt after 5 failures", async () => {
  const counts = new Map<string, number>();
  const verify = createAdminRevocationStepUpVerifier({
    async checkRateLimit(_action, identifier) {
      return { allowed: (counts.get(identifier) ?? 0) < RATE_LIMITS.login.maxAttempts };
    },
    async recordFailure(_action, identifier) {
      counts.set(identifier, (counts.get(identifier) ?? 0) + 1);
    },
    verifyPassword(password) {
      return password === "Secret123!";
    },
  });

  assert.equal(RATE_LIMITS.login.maxAttempts, 5);

  // 5 failed attempts
  for (let i = 0; i < 5; i++) {
    const res = await verify("user-1", "Wrong!", "stored-hash");
    assert.deepEqual(res, { ok: false, reason: "invalid_password" });
  }

  // 6th attempt: blocked even with correct password
  const res6 = await verify("user-1", "Secret123!", "stored-hash");
  assert.deepEqual(res6, { ok: false, reason: "rate_limited" });
});

test("step-up failure counters are isolated per admin user account", async () => {
  const counts = new Map<string, number>();
  const verify = createAdminRevocationStepUpVerifier({
    async checkRateLimit(_action, identifier) {
      return { allowed: (counts.get(identifier) ?? 0) < RATE_LIMITS.login.maxAttempts };
    },
    async recordFailure(_action, identifier) {
      counts.set(identifier, (counts.get(identifier) ?? 0) + 1);
    },
    verifyPassword(password) {
      return password === "Secret123!";
    },
  });

  for (let i = 0; i < 5; i++) {
    await verify("user-1", "Wrong!", "stored-hash");
  }

  assert.deepEqual(await verify("user-1", "Secret123!", "stored-hash"), {
    ok: false,
    reason: "rate_limited",
  });
  assert.deepEqual(await verify("user-2", "Secret123!", "stored-hash"), {
    ok: true,
  });
});

test("verifyAdminRevocationStepUp returns no_password for account without password hash", async () => {
  const fake = createMemoryDatabase({
    selectedRows: [[{ role: "super_admin", passwordHash: null }]],
  });

  const result = await verifyAdminRevocationStepUp("user-1", "some-pass", fake.database);
  assert.deepEqual(result, { ok: false, reason: "no_password" });
});

test("verifyAdminRevocationStepUp returns not_allowed for unauthorized or revoked roles", async () => {
  const fakeLector = createMemoryDatabase({
    selectedRows: [[{ role: "super_admin_lector", passwordHash: "hash" }]],
  });
  assert.deepEqual(
    await verifyAdminRevocationStepUp("user-lector", "pass", fakeLector.database),
    { ok: false, reason: "not_allowed" },
  );

  const fakeNotFound = createMemoryDatabase({ selectedRows: [[]] });
  assert.deepEqual(
    await verifyAdminRevocationStepUp("user-absent", "pass", fakeNotFound.database),
    { ok: false, reason: "not_allowed" },
  );
});

// ---------------------------------------------------------------------------
// 3. Role authorization rules in revokeSuperAdminAccount
// ---------------------------------------------------------------------------

test("revokeSuperAdminAccount rejects self-revocation before transaction", async () => {
  const fake = createMemoryDatabase();
  const result = await revokeSuperAdminAccount({
    actorId: "actor-1",
    targetId: "actor-1",
    password: "Password123!",
  }, fake.database);

  assert.deepEqual(result, { ok: false, reason: "self_revocation" });
  assert.equal(fake.transactionCount, 0);
});

test("revokeSuperAdminAccount rejects when target is super_admin", async () => {
  const fake = createMemoryDatabase({
    selectedRows: [
      // Actor in tx
      [{ id: "chief-1", email: "chief1@tablino.test", role: "super_admin", revokedAt: null }],
      // Target in tx: super_admin
      [{ id: "chief-2", email: "chief2@tablino.test", role: "super_admin", revokedAt: null }],
    ],
  });

  const result = await revokeSuperAdminAccount(
    { actorId: "chief-1", targetId: "chief-2", password: "Password123!" },
    {
      database: fake.database,
      stepUpVerifier: async () => ({ ok: true }),
    },
  );

  assert.deepEqual(result, { ok: false, reason: "target_not_allowed" });
});

test("revokeSuperAdminAccount rejects when editor attempts to revoke another editor", async () => {
  const fake = createMemoryDatabase({
    selectedRows: [
      // Actor in tx: editor
      [{ id: "editor-1", email: "editor1@tablino.test", role: "super_admin_editor", revokedAt: null }],
      // Target in tx: editor
      [{ id: "editor-2", email: "editor2@tablino.test", role: "super_admin_editor", revokedAt: null }],
    ],
  });

  const result = await revokeSuperAdminAccount(
    { actorId: "editor-1", targetId: "editor-2", password: "Password123!" },
    {
      database: fake.database,
      stepUpVerifier: async () => ({ ok: true }),
    },
  );

  assert.deepEqual(result, { ok: false, reason: "insufficient_permissions" });
});

test("revokeSuperAdminAccount allows editor to revoke lector", async () => {
  const fake = createMemoryDatabase({
    selectedRows: [
      // Actor: editor
      [{ id: "editor-1", email: "editor1@tablino.test", role: "super_admin_editor", revokedAt: null }],
      // Target: lector
      [{ id: "lector-1", email: "lector1@tablino.test", role: "super_admin_lector", revokedAt: null }],
    ],
    updateResults: [
      // Target revokedAt update
      [{ id: "lector-1" }],
      // Pending invitations update
      [],
    ],
    deleteResults: [
      // Sessions delete
      [{ id: "s-1" }],
    ],
    insertResults: [
      // Audit insert
      [{ id: "audit-1" }],
    ],
  });

  const result = await revokeSuperAdminAccount(
    { actorId: "editor-1", targetId: "lector-1", password: "Password123!" },
    {
      database: fake.database,
      now: NOW,
      stepUpVerifier: async () => ({ ok: true }),
    },
  );

  assert.deepEqual(result, { ok: true, auditId: "audit-1" });
});

test("revokeSuperAdminAccount allows super_admin to revoke editor", async () => {
  const fake = createMemoryDatabase({
    selectedRows: [
      // Actor: super_admin
      [{ id: "chief-1", email: "chief1@tablino.test", role: "super_admin", revokedAt: null }],
      // Target: editor
      [{ id: "editor-1", email: "editor1@tablino.test", role: "super_admin_editor", revokedAt: null }],
    ],
    updateResults: [
      [{ id: "editor-1" }],
      [],
    ],
    deleteResults: [
      [{ id: "s-1" }],
    ],
    insertResults: [
      [{ id: "audit-editor-revoked" }],
    ],
  });

  const result = await revokeSuperAdminAccount(
    { actorId: "chief-1", targetId: "editor-1", password: "Password123!" },
    {
      database: fake.database,
      now: NOW,
      stepUpVerifier: async () => ({ ok: true }),
    },
  );

  assert.deepEqual(result, { ok: true, auditId: "audit-editor-revoked" });
});

test("revokeSuperAdminAccount allows super_admin to revoke lector", async () => {
  const fake = createMemoryDatabase({
    selectedRows: [
      // Actor: super_admin
      [{ id: "chief-1", email: "chief1@tablino.test", role: "super_admin", revokedAt: null }],
      // Target: lector
      [{ id: "lector-1", email: "lector1@tablino.test", role: "super_admin_lector", revokedAt: null }],
    ],
    updateResults: [
      [{ id: "lector-1" }],
      [],
    ],
    deleteResults: [
      [],
    ],
    insertResults: [
      [{ id: "audit-lector-revoked" }],
    ],
  });

  const result = await revokeSuperAdminAccount(
    { actorId: "chief-1", targetId: "lector-1", password: "Password123!" },
    {
      database: fake.database,
      now: NOW,
      stepUpVerifier: async () => ({ ok: true }),
    },
  );

  assert.deepEqual(result, { ok: true, auditId: "audit-lector-revoked" });
});

test("revokeSuperAdminAccount rejects when actor is lector", async () => {
  const fake = createMemoryDatabase({
    selectedRows: [
      // Actor: lector
      [{ id: "lector-1", email: "lector1@tablino.test", role: "super_admin_lector", revokedAt: null }],
    ],
  });

  const result = await revokeSuperAdminAccount(
    { actorId: "lector-1", targetId: "lector-2", password: "Password123!" },
    {
      database: fake.database,
      stepUpVerifier: async () => ({ ok: true }),
    },
  );

  assert.deepEqual(result, { ok: false, reason: "not_allowed" });
});

test("revokeSuperAdminAccount rejects when target is already revoked", async () => {
  const fake = createMemoryDatabase({
    selectedRows: [
      [{ id: "chief-1", email: "chief1@tablino.test", role: "super_admin", revokedAt: null }],
      [{ id: "editor-1", email: "editor1@tablino.test", role: "super_admin_editor", revokedAt: new Date() }],
    ],
  });

  const result = await revokeSuperAdminAccount(
    { actorId: "chief-1", targetId: "editor-1", password: "Password123!" },
    {
      database: fake.database,
      stepUpVerifier: async () => ({ ok: true }),
    },
  );

  assert.deepEqual(result, { ok: false, reason: "target_already_revoked" });
});

test("revokeSuperAdminAccount rejects when target is not found", async () => {
  const fake = createMemoryDatabase({
    selectedRows: [
      [{ id: "chief-1", email: "chief1@tablino.test", role: "super_admin", revokedAt: null }],
      [],
    ],
  });

  const result = await revokeSuperAdminAccount(
    { actorId: "chief-1", targetId: "non-existent", password: "Password123!" },
    {
      database: fake.database,
      stepUpVerifier: async () => ({ ok: true }),
    },
  );

  assert.deepEqual(result, { ok: false, reason: "target_not_found" });
});

// ---------------------------------------------------------------------------
// 4. Successful revocation effects & mutations
// ---------------------------------------------------------------------------

test("successful revocation updates target, deletes sessions, revokes pending invitations and logs audit", async () => {
  const fake = createMemoryDatabase({
    selectedRows: [
      [{ id: "chief-1", email: "chief1@tablino.test", role: "super_admin", revokedAt: null }],
      [{ id: "editor-1", email: "editor1@tablino.test", role: "super_admin_editor", revokedAt: null }],
    ],
    updateResults: [
      [{ id: "editor-1" }],
      [],
    ],
    deleteResults: [
      [{ id: "session-1" }, { id: "session-2" }],
    ],
    insertResults: [
      [{ id: "audit-success-123" }],
    ],
  });

  const result = await revokeSuperAdminAccount(
    { actorId: "chief-1", targetId: "editor-1", password: "Password123!" },
    {
      database: fake.database,
      now: NOW,
      stepUpVerifier: async () => ({ ok: true }),
    },
  );

  assert.deepEqual(result, { ok: true, auditId: "audit-success-123" });

  // Verify updates:
  // 1st update on users: revokedAt = NOW
  assert.equal(fake.updates.length, 2);
  assert.equal(fake.updates[0].values?.revokedAt, NOW);

  // 2nd update on adminInvitations: revokedAt = NOW
  assert.equal(fake.updates[1].values?.revokedAt, NOW);

  // Verify delete on sessions
  assert.equal(fake.deletes.length, 1);

  // Verify audit insertion snapshot & 12 months retention
  assert.equal(fake.inserts.length, 1);
  const auditValues = fake.inserts[0].values as Record<string, unknown>;
  assert.equal(auditValues.revokedUserId, "editor-1");
  assert.equal(auditValues.revokedByUserId, "chief-1");
  assert.equal(auditValues.revokedEmail, "editor1@tablino.test");
  assert.equal(auditValues.revokerEmail, "chief1@tablino.test");
  assert.equal(auditValues.revokedRole, "super_admin_editor");
  assert.equal(auditValues.revokerRole, "super_admin");
  assert.equal(auditValues.createdAt, NOW);

  // Expiry is 12 months later
  const expiresAt = auditValues.expiresAt as Date;
  assert.equal(expiresAt.toISOString(), "2027-11-21T12:00:00.000Z");
  assert.equal(ADMIN_REVOCATION_AUDIT_RETENTION_MONTHS, 12);
});

// ---------------------------------------------------------------------------
// 5. Transaction rollback on audit failure
// ---------------------------------------------------------------------------

test("failure at audit insertion triggers transaction rollback", async () => {
  const fake = createMemoryDatabase({
    selectedRows: [
      [{ id: "chief-1", email: "chief1@tablino.test", role: "super_admin", revokedAt: null }],
      [{ id: "editor-1", email: "editor1@tablino.test", role: "super_admin_editor", revokedAt: null }],
    ],
    updateResults: [
      [{ id: "editor-1" }],
      [],
    ],
    deleteResults: [
      [],
    ],
    insertResults: [
      // Audit insertion fails (returns empty array)
      [],
    ],
  });

  await assert.rejects(
    async () => {
      await revokeSuperAdminAccount(
        { actorId: "chief-1", targetId: "editor-1", password: "Password123!" },
        {
          database: fake.database,
          now: NOW,
          stepUpVerifier: async () => ({ ok: true }),
        },
      );
    },
    /Échec d’écriture du journal de révocation/,
  );
});
