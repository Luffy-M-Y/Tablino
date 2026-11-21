import assert from "node:assert/strict";
import test from "node:test";
import {
  ADMIN_REVOCATION_ALERT_LEASE_MS,
  ADMIN_REVOCATION_ALERT_RETENTION_MS,
  ADMIN_REVOCATION_ALERT_RETRY_DELAYS_MS,
  getAdminRevocationAlertFailureState,
  getAdminRevocationAlertReservationState,
  isAdminRevocationAlertReservationDue,
  isRevokedAdminRole,
  enqueueAdminRevocationAlerts,
  processAdminRevocationAlertOutbox,
} from "../src/admin-revocation-outbox";

const NOW = new Date("2026-11-21T12:00:00.000Z");

type LimitResult = {
  for: (mode: unknown, options?: unknown) => LimitResult;
  then: (
    onFulfilled?: ((value: unknown) => unknown) | null,
    onRejected?: ((reason: unknown) => unknown) | null,
  ) => Promise<unknown>;
};

type SelectQuery = {
  from: (table: unknown) => SelectQuery;
  innerJoin: (table: unknown, condition: unknown) => SelectQuery;
  where: (condition: unknown) => SelectQuery;
  orderBy: (order: unknown) => SelectQuery;
  for: (mode: unknown, options?: unknown) => SelectQuery;
  limit: (count: number) => LimitResult;
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
      limit: () => {
        const rows = selectedRows.shift() ?? [];
        const resolved = Promise.resolve(rows);
        const limitResult: LimitResult = {
          for: () => limitResult,
          then: (onFulfilled, onRejected) => resolved.then(onFulfilled, onRejected),
        };
        return limitResult;
      },
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
// 1. State machine & Retry logic tests
// ---------------------------------------------------------------------------

test("first alert failure schedules attempt two 20 minutes later", () => {
  assert.deepEqual(getAdminRevocationAlertFailureState(1, NOW), {
    status: "pending",
    nextAttemptAt: new Date(NOW.getTime() + 20 * 60 * 1000),
  });
});

test("second alert failure schedules attempt three at 60 minutes total", () => {
  const secondAttemptAt = new Date(NOW.getTime() + 20 * 60 * 1000);
  assert.deepEqual(getAdminRevocationAlertFailureState(2, secondAttemptAt), {
    status: "pending",
    nextAttemptAt: new Date(NOW.getTime() + 60 * 60 * 1000),
  });
});

test("third alert failure is final with status failed and null nextAttemptAt", () => {
  assert.deepEqual(getAdminRevocationAlertFailureState(3, NOW), {
    status: "failed",
    nextAttemptAt: null,
  });
});

test("invalid attempt counts in failure state throw RangeError", () => {
  assert.throws(() => getAdminRevocationAlertFailureState(0, NOW), RangeError);
  assert.throws(() => getAdminRevocationAlertFailureState(4, NOW), RangeError);
});

test("reservation uses a 10-minute lease and increments attempts", () => {
  assert.deepEqual(getAdminRevocationAlertReservationState(0, NOW), {
    status: "processing",
    attempts: 1,
    nextAttemptAt: new Date(NOW.getTime() + 10 * 60 * 1000),
  });
  assert.deepEqual(getAdminRevocationAlertReservationState(2, NOW), {
    status: "processing",
    attempts: 3,
    nextAttemptAt: new Date(NOW.getTime() + 10 * 60 * 1000),
  });
});

test("reservation at max attempts (3) returns failed", () => {
  assert.deepEqual(getAdminRevocationAlertReservationState(3, NOW), {
    status: "failed",
    attempts: 3,
    nextAttemptAt: null,
  });
});

test("invalid reservation attempt counts throw RangeError", () => {
  assert.throws(() => getAdminRevocationAlertReservationState(-1, NOW), RangeError);
  assert.throws(() => getAdminRevocationAlertReservationState(4, NOW), RangeError);
});

test("an expired reservation lease becomes eligible again", () => {
  const leaseExpiresAt = new Date(NOW.getTime() + ADMIN_REVOCATION_ALERT_LEASE_MS);

  assert.equal(isAdminRevocationAlertReservationDue("processing", leaseExpiresAt, NOW), false);
  assert.equal(
    isAdminRevocationAlertReservationDue("processing", leaseExpiresAt, leaseExpiresAt),
    true,
  );
  assert.equal(isAdminRevocationAlertReservationDue("sent", leaseExpiresAt, leaseExpiresAt), false);
  assert.equal(isAdminRevocationAlertReservationDue("failed", leaseExpiresAt, leaseExpiresAt), false);
});

test("outbox constants match 90 days retention, 10 min lease, 20m and 40m retry delays", () => {
  assert.equal(ADMIN_REVOCATION_ALERT_RETENTION_MS, 90 * 24 * 60 * 60 * 1000);
  assert.equal(ADMIN_REVOCATION_ALERT_LEASE_MS, 10 * 60 * 1000);
  assert.deepEqual(ADMIN_REVOCATION_ALERT_RETRY_DELAYS_MS, [20 * 60 * 1000, 40 * 60 * 1000]);
});

test("isRevokedAdminRole validates super_admin_editor and super_admin_lector only", () => {
  assert.equal(isRevokedAdminRole("super_admin_editor"), true);
  assert.equal(isRevokedAdminRole("super_admin_lector"), true);
  assert.equal(isRevokedAdminRole("super_admin"), false);
  assert.equal(isRevokedAdminRole("student"), false);
  assert.equal(isRevokedAdminRole(null), false);
});

// ---------------------------------------------------------------------------
// 2. enqueueAdminRevocationAlerts
// ---------------------------------------------------------------------------

test("enqueueAdminRevocationAlerts returns 0 when audit is not found", async () => {
  const fake = createMemoryDatabase({ selectedRows: [[]] });
  const count = await enqueueAdminRevocationAlerts("non-existent", NOW, fake.database);
  assert.equal(count, 0);
});

test("enqueueAdminRevocationAlerts enqueues alerts for super_admin and super_admin_editor", async () => {
  const fake = createMemoryDatabase({
    selectedRows: [
      // Audit row
      [{ id: "audit-1", createdAt: NOW }],
      // Recipient users
      [
        { email: "chief@tablino.test" },
        { email: "editor@tablino.test" },
      ],
    ],
    insertResults: [
      [{ id: "outbox-1" }, { id: "outbox-2" }],
    ],
  });

  const count = await enqueueAdminRevocationAlerts("audit-1", NOW, fake.database);
  assert.equal(count, 2);
  assert.equal(fake.inserts.length, 1);
  const insertedValues = fake.inserts[0].values as Array<Record<string, unknown>>;
  assert.equal(insertedValues.length, 2);
  assert.equal(insertedValues[0].recipientEmail, "chief@tablino.test");
  assert.equal(insertedValues[0].status, "pending");
  assert.equal(insertedValues[0].attempts, 0);
  assert.equal(
    (insertedValues[0].expiresAt as Date).getTime(),
    NOW.getTime() + ADMIN_REVOCATION_ALERT_RETENTION_MS,
  );
});

// ---------------------------------------------------------------------------
// 3. processAdminRevocationAlertOutbox
// ---------------------------------------------------------------------------

test("processAdminRevocationAlertOutbox sends alert, updates status to sent, and purges expired rows", async () => {
  const outboxRow = {
    id: "alert-1",
    attempts: 0,
    recipientEmail: "chief@tablino.test",
    revokerEmail: "editor@tablino.test",
    revokedEmail: "lector@tablino.test",
    revokedRole: "super_admin_lector",
    revokedAt: NOW,
  };

  const fake = createMemoryDatabase({
    selectedRows: [
      [outboxRow],
      [], // next batch empty
    ],
    updateResults: [
      // Reservation update in tx
      [{ id: "alert-1" }],
      // Sent update after delivery
      [{ id: "alert-1" }],
    ],
  });

  const sentAlerts: Array<unknown> = [];
  const result = await processAdminRevocationAlertOutbox(
    async (alert) => {
      sentAlerts.push(alert);
    },
    NOW,
    fake.database,
  );

  assert.deepEqual(result, {
    processed: 1,
    sent: 1,
    retried: 0,
    failed: 0,
  });
  assert.equal(sentAlerts.length, 1);
  assert.deepEqual(sentAlerts[0], {
    recipientEmail: "chief@tablino.test",
    revokerEmail: "editor@tablino.test",
    revokedEmail: "lector@tablino.test",
    revokedRole: "super_admin_lector",
    revokedAt: NOW,
  });

  // Verify purge calls: at start and at end
  assert.equal(fake.deletes.length, 4);
});

test("processAdminRevocationAlertOutbox handles send failure by rescheduling retry", async () => {
  const outboxRow = {
    id: "alert-retry-1",
    attempts: 0,
    recipientEmail: "chief@tablino.test",
    revokerEmail: "editor@tablino.test",
    revokedEmail: "lector@tablino.test",
    revokedRole: "super_admin_lector",
    revokedAt: NOW,
  };

  const fake = createMemoryDatabase({
    selectedRows: [
      [outboxRow],
      [],
    ],
    updateResults: [
      // Reservation
      [{ id: "alert-retry-1" }],
      // Retry update
      [{ id: "alert-retry-1" }],
    ],
  });

  const result = await processAdminRevocationAlertOutbox(
    async () => {
      throw new Error("SMTP temporary failure");
    },
    NOW,
    fake.database,
  );

  assert.deepEqual(result, {
    processed: 1,
    sent: 0,
    retried: 1,
    failed: 0,
  });
});
