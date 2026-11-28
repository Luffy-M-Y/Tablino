import assert from "node:assert/strict";
import test from "node:test";
import {
  confirmAdminTotpEnrollment,
  getAdminTotpState,
  startAdminTotpEnrollment,
} from "../src/admin-totp";
import * as schema from "../src/schema";

// Harnais : les lignes simulées sont rendues dans l'ordre des requêtes ; le where n'est pas exécuté.
type SelectQuery = {
  from: (table: unknown) => SelectQuery;
  where: (condition: unknown) => SelectQuery;
  for: (lock: "update") => SelectQuery;
  limit: (count: number) => Promise<unknown[]>;
};

type WriteRecord = {
  kind: "insert" | "update";
  table: unknown;
  values?: Record<string, unknown>;
  conflict?: Record<string, unknown>;
  condition?: unknown;
};

function createMemoryDatabase({
  selectedRows = [],
  writeResults = [],
}: {
  selectedRows?: unknown[][];
  writeResults?: unknown[][];
} = {}) {
  const selects: Array<{ table?: unknown; lock?: "update" }> = [];
  const writes: WriteRecord[] = [];
  let transactionCount = 0;

  const select = (): SelectQuery => {
    const record: { table?: unknown; lock?: "update" } = {};
    selects.push(record);
    const query: SelectQuery = {
      from: (table) => {
        record.table = table;
        return query;
      },
      where: () => query,
      for: (lock) => {
        record.lock = lock;
        return query;
      },
      limit: async () => selectedRows.shift() ?? [],
    };
    return query;
  };

  const tx = {
    select,
    insert: (table: unknown) => {
      const record: WriteRecord = { kind: "insert", table };
      writes.push(record);
      const chain = {
        values: (values: Record<string, unknown>) => {
          record.values = values;
          return chain;
        },
        onConflictDoUpdate: (conflict: Record<string, unknown>) => {
          record.conflict = conflict;
          return chain;
        },
        returning: async () => writeResults.shift() ?? [],
      };
      return chain;
    },
    update: (table: unknown) => {
      const record: WriteRecord = { kind: "update", table };
      writes.push(record);
      const chain = {
        set: (values: Record<string, unknown>) => {
          record.values = values;
          return chain;
        },
        where: (condition: unknown) => {
          record.condition = condition;
          return chain;
        },
        returning: async () => writeResults.shift() ?? [],
      };
      return chain;
    },
  };

  return {
    database: {
      select,
      transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => {
        transactionCount++;
        return callback(tx);
      },
    } as never,
    selects,
    writes,
    get transactionCount() {
      return transactionCount;
    },
  };
}

const NOW = new Date("2026-11-28T10:00:00.000Z");
const activeAdmin = { role: "university_admin", revokedAt: null, email: "admin@example.test" };

// ─── getAdminTotpState ────────────────────────────────────────────────────────

test("getAdminTotpState refuse une entrée invalide sans requête", async () => {
  const fake = createMemoryDatabase();
  for (const input of [{ userId: "  " }, { userId: 42 as never }, null as never]) {
    assert.deepEqual(await getAdminTotpState(input, fake.database), { ok: false, reason: "invalid_input" });
  }
  assert.equal(fake.selects.length, 0);
});

test("getAdminTotpState refuse un utilisateur absent, révoqué ou étudiant", async () => {
  const cases = [
    [],
    [{ ...activeAdmin, revokedAt: new Date("2026-11-01T00:00:00.000Z") }],
    [{ ...activeAdmin, role: "student" }],
  ];
  for (const userRows of cases) {
    const fake = createMemoryDatabase({ selectedRows: [userRows] });
    assert.deepEqual(
      await getAdminTotpState({ userId: "user-1" }, fake.database),
      { ok: false, reason: "not_authorized" },
    );
    assert.equal(fake.selects.length, 1);
  }
});

test("getAdminTotpState renvoie none, pending ou enabled", async () => {
  const none = createMemoryDatabase({ selectedRows: [[activeAdmin], []] });
  assert.deepEqual(
    await getAdminTotpState({ userId: "user-1" }, none.database),
    { ok: true, status: "none", email: "admin@example.test" },
  );
  assert.equal(none.selects[1].table, schema.adminTotp);

  const pending = createMemoryDatabase({
    selectedRows: [[{ ...activeAdmin, role: "super_admin_lector" }], [{ secretEncrypted: "v1:abc", enabledAt: null }]],
  });
  assert.deepEqual(
    await getAdminTotpState({ userId: "user-1" }, pending.database),
    { ok: true, status: "pending", email: "admin@example.test", secretEncrypted: "v1:abc" },
  );

  const enabled = createMemoryDatabase({
    selectedRows: [[{ ...activeAdmin, role: "super_admin" }], [{ secretEncrypted: "v1:abc", enabledAt: NOW }]],
  });
  const enabledState = await getAdminTotpState({ userId: "user-1" }, enabled.database);
  assert.deepEqual(enabledState, { ok: true, status: "enabled", email: "admin@example.test" });
  assert.equal("secretEncrypted" in enabledState, false);
});

// ─── startAdminTotpEnrollment ─────────────────────────────────────────────────

test("startAdminTotpEnrollment refuse une entrée invalide sans transaction", async () => {
  const fake = createMemoryDatabase();
  const inputs = [
    { userId: " ", secretEncrypted: "v1:abc" },
    { userId: "user-1", secretEncrypted: "" },
    { userId: "user-1", secretEncrypted: 7 as never },
    null as never,
  ];
  for (const input of inputs) {
    assert.deepEqual(await startAdminTotpEnrollment(input, fake.database, NOW), { ok: false, reason: "invalid_input" });
  }
  assert.equal(fake.transactionCount, 0);
});

test("startAdminTotpEnrollment refuse un admin révoqué ou un étudiant sans écrire", async () => {
  const cases = [
    [],
    [{ role: "super_admin_editor", revokedAt: new Date("2026-11-01T00:00:00.000Z") }],
    [{ role: "student", revokedAt: null }],
  ];
  for (const userRows of cases) {
    const fake = createMemoryDatabase({ selectedRows: [userRows] });
    assert.deepEqual(
      await startAdminTotpEnrollment({ userId: "user-1", secretEncrypted: "v1:abc" }, fake.database, NOW),
      { ok: false, reason: "not_authorized" },
    );
    assert.equal(fake.writes.length, 0);
  }
});

test("startAdminTotpEnrollment enregistre le secret en attente, sans écraser une 2FA active", async () => {
  const fake = createMemoryDatabase({
    selectedRows: [[{ role: "university_admin", revokedAt: null }]],
    writeResults: [[{ userId: "user-1" }]],
  });
  const result = await startAdminTotpEnrollment({ userId: " user-1 ", secretEncrypted: "v1:abc" }, fake.database, NOW);
  assert.deepEqual(result, { ok: true });
  assert.equal(fake.selects[0].table, schema.users);
  assert.equal(fake.selects[0].lock, "update");
  assert.equal(fake.writes.length, 1);
  const write = fake.writes[0];
  assert.equal(write.kind, "insert");
  assert.equal(write.table, schema.adminTotp);
  assert.deepEqual(write.values, {
    userId: "user-1",
    secretEncrypted: "v1:abc",
    enabledAt: null,
    lastUsedStep: null,
    createdAt: NOW,
    updatedAt: NOW,
  });
  assert.equal(write.conflict?.target, schema.adminTotp.userId);
  assert.deepEqual(write.conflict?.set, { secretEncrypted: "v1:abc", lastUsedStep: null, updatedAt: NOW });
  assert.ok(write.conflict?.setWhere, "setWhere (enabled_at IS NULL) obligatoire");
});

test("startAdminTotpEnrollment renvoie already_enabled si aucune ligne n'est écrite", async () => {
  const fake = createMemoryDatabase({
    selectedRows: [[{ role: "super_admin", revokedAt: null }]],
    writeResults: [[]],
  });
  assert.deepEqual(
    await startAdminTotpEnrollment({ userId: "user-1", secretEncrypted: "v1:abc" }, fake.database, NOW),
    { ok: false, reason: "already_enabled" },
  );
});

// ─── confirmAdminTotpEnrollment ───────────────────────────────────────────────

test("confirmAdminTotpEnrollment refuse une entrée invalide sans transaction", async () => {
  const fake = createMemoryDatabase();
  const inputs = [
    { userId: "", secretEncrypted: "v1:abc", step: 1 },
    { userId: "user-1", secretEncrypted: " ", step: 1 },
    { userId: "user-1", secretEncrypted: "v1:abc", step: -1 },
    { userId: "user-1", secretEncrypted: "v1:abc", step: 1.5 },
    { userId: "user-1", secretEncrypted: "v1:abc", step: "1" as never },
    null as never,
  ];
  for (const input of inputs) {
    assert.deepEqual(await confirmAdminTotpEnrollment(input, fake.database, NOW), { ok: false, reason: "invalid_input" });
  }
  assert.equal(fake.transactionCount, 0);
});

test("confirmAdminTotpEnrollment refuse un admin révoqué ou un étudiant sans écrire", async () => {
  const cases = [
    [],
    [{ role: "university_admin", revokedAt: new Date("2026-11-01T00:00:00.000Z") }],
    [{ role: "student", revokedAt: null }],
  ];
  for (const userRows of cases) {
    const fake = createMemoryDatabase({ selectedRows: [userRows] });
    assert.deepEqual(
      await confirmAdminTotpEnrollment({ userId: "user-1", secretEncrypted: "v1:abc", step: 10 }, fake.database, NOW),
      { ok: false, reason: "not_authorized" },
    );
    assert.equal(fake.writes.length, 0);
  }
});

test("confirmAdminTotpEnrollment active la 2FA et mémorise le pas utilisé", async () => {
  const fake = createMemoryDatabase({
    selectedRows: [[{ role: "super_admin_lector", revokedAt: null }]],
    writeResults: [[{ userId: "user-1" }]],
  });
  assert.deepEqual(
    await confirmAdminTotpEnrollment({ userId: "user-1", secretEncrypted: "v1:abc", step: 59_000_000 }, fake.database, NOW),
    { ok: true },
  );
  assert.equal(fake.selects[0].lock, "update");
  assert.equal(fake.writes.length, 1);
  assert.equal(fake.writes[0].kind, "update");
  assert.equal(fake.writes[0].table, schema.adminTotp);
  assert.deepEqual(fake.writes[0].values, { enabledAt: NOW, lastUsedStep: 59_000_000, updatedAt: NOW });
  assert.ok(fake.writes[0].condition, "condition (utilisateur, secret, enabled_at IS NULL) obligatoire");
});

test("confirmAdminTotpEnrollment renvoie not_pending si le secret a changé ou est déjà actif", async () => {
  const fake = createMemoryDatabase({
    selectedRows: [[{ role: "university_admin", revokedAt: null }]],
    writeResults: [[]],
  });
  assert.deepEqual(
    await confirmAdminTotpEnrollment({ userId: "user-1", secretEncrypted: "v1:abc", step: 10 }, fake.database, NOW),
    { ok: false, reason: "not_pending" },
  );
});
