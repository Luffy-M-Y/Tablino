import assert from "node:assert/strict";
import test from "node:test";
import {
  recordVerifiedPayment,
  startTrial,
} from "../src/subscriptions";
import * as schema from "../src/schema";

type InsertRecord = {
  table: unknown;
  values?: Record<string, unknown>;
  conflictTarget?: unknown;
};

type UpdateRecord = {
  table: unknown;
  values: Record<string, unknown>;
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
  selectResults: unknown[][] = [],
  insertResults: unknown[][] = [],
) {
  const inserts: InsertRecord[] = [];
  const updates: UpdateRecord[] = [];
  const lockModes: string[] = [];
  let transactionCount = 0;

  const tx = {
    select: () => {
      const query: SelectQuery = {
        from: () => query,
        where: () => query,
        for: (mode) => {
          lockModes.push(mode);
          return query;
        },
        limit: async () => selectResults.shift() ?? [],
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
        onConflictDoNothing: ({ target }) => {
          record.conflictTarget = target;
          return chain;
        },
        returning: async () => insertResults.shift() ?? [],
      };
      return chain;
    },
    update: (table: unknown) => {
      const record: UpdateRecord = { table, values: {} };
      const chain: UpdateChain = {
        set: (values) => {
          record.values = values;
          return chain;
        },
        where: async () => {
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
    lockModes,
    get transactionCount() {
      return transactionCount;
    },
  };
}

function studentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "student-a",
    role: "student",
    revokedAt: null,
    trialStartedAt: null,
    trialEndsAt: null,
    currentPlan: null,
    subscriptionExpiresAt: null,
    ...overrides,
  };
}

function paymentInput(overrides: Record<string, unknown> = {}) {
  return {
    universityId: "university-a",
    userId: "student-a",
    plan: "premium_pro",
    provider: "provider-a",
    transactionId: "transaction-a",
    amountXof: 1000,
    ...overrides,
  };
}

test("startTrial starts a thirty-day trial and locks the student", async () => {
  const now = new Date("2026-10-25T00:00:00.000Z");
  const fake = createMemoryDatabase([[studentRow()]]);

  const result = await startTrial("university-a", "student-a", fake.database, now);

  assert.deepEqual(result, {
    ok: true,
    trialEndsAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
  });
  assert.deepEqual(fake.lockModes, ["update"]);
  assert.equal(fake.updates.length, 1);
  assert.equal(fake.updates[0].table, schema.users);
  assert.equal(fake.updates[0].values.trialStartedAt, now);
  assert.equal(
    (fake.updates[0].values.trialEndsAt as Date).getTime(),
    now.getTime() + 30 * 24 * 60 * 60 * 1000,
  );
});

test("startTrial rejects an absent student", async () => {
  const fake = createMemoryDatabase([[]]);

  assert.deepEqual(await startTrial("university-a", "student-a", fake.database), {
    ok: false,
    reason: "not_found",
  });
  assert.deepEqual(fake.updates, []);
});

test("startTrial rejects a non-student role", async () => {
  const fake = createMemoryDatabase([[studentRow({ role: "university_admin" })]]);

  assert.deepEqual(await startTrial("university-a", "student-a", fake.database), {
    ok: false,
    reason: "not_found",
  });
  assert.deepEqual(fake.updates, []);
});

test("startTrial rejects revoked students", async () => {
  const fake = createMemoryDatabase([[studentRow({ revokedAt: new Date() })]]);

  assert.deepEqual(await startTrial("university-a", "student-a", fake.database), {
    ok: false,
    reason: "revoked",
  });
  assert.deepEqual(fake.updates, []);
});

test("startTrial rejects a previously used trial", async () => {
  const fake = createMemoryDatabase([[studentRow({ trialStartedAt: new Date() })]]);

  assert.deepEqual(await startTrial("university-a", "student-a", fake.database), {
    ok: false,
    reason: "trial_already_used",
  });
  assert.deepEqual(fake.updates, []);
});

test("startTrial rejects students with a current plan", async () => {
  const fake = createMemoryDatabase([[studentRow({ currentPlan: "premium_pro" })]]);

  assert.deepEqual(await startTrial("university-a", "student-a", fake.database), {
    ok: false,
    reason: "already_subscribed",
  });
  assert.deepEqual(fake.updates, []);
});

test("recordVerifiedPayment rejects invalid plans and mismatched amounts before transactions", async () => {
  for (const [input, reason] of [
    [paymentInput({ plan: "pro" }), "invalid_plan"],
    [paymentInput({ amountXof: 2500 }), "amount_mismatch"],
  ] as const) {
    const fake = createMemoryDatabase();

    assert.deepEqual(await recordVerifiedPayment(input, fake.database), {
      ok: false,
      reason,
    });
    assert.equal(fake.transactionCount, 0);
  }
});

test("recordVerifiedPayment rejects an absent student", async () => {
  const fake = createMemoryDatabase([[]]);

  assert.deepEqual(await recordVerifiedPayment(paymentInput(), fake.database), {
    ok: false,
    reason: "not_found",
  });
});

test("recordVerifiedPayment rejects revoked students", async () => {
  const fake = createMemoryDatabase([[studentRow({ revokedAt: new Date() })]]);

  assert.deepEqual(await recordVerifiedPayment(paymentInput(), fake.database), {
    ok: false,
    reason: "revoked",
  });
});

test("recordVerifiedPayment rejects a missing university", async () => {
  const fake = createMemoryDatabase([[studentRow()], []]);

  assert.deepEqual(await recordVerifiedPayment(paymentInput(), fake.database), {
    ok: false,
    reason: "university_not_found",
  });
});

test("recordVerifiedPayment rejects an invalid revenue share", async () => {
  const fake = createMemoryDatabase([[studentRow()], [{ revenueShareBps: 10001 }]]);

  assert.deepEqual(await recordVerifiedPayment(paymentInput(), fake.database), {
    ok: false,
    reason: "invalid_share",
  });
  assert.deepEqual(fake.inserts, []);
  assert.deepEqual(fake.updates, []);
});

test("recordVerifiedPayment records a paid plan and splits the amount", async () => {
  const now = new Date("2026-10-25T00:00:00.000Z");
  const fake = createMemoryDatabase(
    [[studentRow()], [{ revenueShareBps: 3000 }]],
    [[{ id: "subscription-a" }]],
  );

  const result = await recordVerifiedPayment(paymentInput(), fake.database, now);

  if (!result.ok || result.duplicate) { assert.fail("unexpected result"); }
  assert.deepEqual(result, {
    ok: true,
    duplicate: false,
    periodStart: now,
    periodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
    universityAmount: 300,
    platformAmount: 700,
  });
  assert.equal(fake.inserts.length, 1);
  assert.equal(fake.inserts[0].table, schema.subscriptions);
  assert.equal(fake.inserts[0].conflictTarget, schema.subscriptions.transactionId);
  assert.deepEqual(fake.inserts[0].values, {
    userId: "student-a",
    provider: "provider-a",
    transactionId: "transaction-a",
    amount: 1000,
    status: "paid",
    periodStart: now,
    periodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
    webhookVerified: true,
    plan: "premium_pro",
    universityId: "university-a",
    shareBps: 3000,
    universityAmount: 300,
    platformAmount: 700,
  });
  assert.equal(fake.updates.length, 1);
  assert.equal(fake.updates[0].table, schema.users);
  assert.equal(fake.updates[0].values.currentPlan, "premium_pro");
  assert.deepEqual(fake.updates[0].values.subscriptionExpiresAt, result.periodEnd);
});

test("recordVerifiedPayment starts the next period after a future subscription expiry", async () => {
  const now = new Date("2026-10-25T00:00:00.000Z");
  const subscriptionExpiresAt = new Date(now.getTime() + 1000);
  const fake = createMemoryDatabase(
    [
      [studentRow({ subscriptionExpiresAt })],
      [{ revenueShareBps: 3000 }],
    ],
    [[{ id: "subscription-a" }]],
  );

  const result = await recordVerifiedPayment(paymentInput(), fake.database, now);

  assert.equal(result.ok, true);
  if (!result.ok || result.duplicate) return;
  assert.equal(result.periodStart.getTime(), subscriptionExpiresAt.getTime());
  assert.equal(
    result.periodEnd.getTime(),
    subscriptionExpiresAt.getTime() + 30 * 24 * 60 * 60 * 1000,
  );
  assert.equal(fake.updates[0].values.subscriptionExpiresAt, result.periodEnd);
});

test("recordVerifiedPayment starts after a future trial expiry", async () => {
  const now = new Date("2026-10-25T00:00:00.000Z");
  const trialEndsAt = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
  const fake = createMemoryDatabase(
    [
      [studentRow({ trialEndsAt })],
      [{ revenueShareBps: 3000 }],
    ],
    [[{ id: "subscription-a" }]],
  );

  const result = await recordVerifiedPayment(paymentInput(), fake.database, now);

  assert.equal(result.ok, true);
  if (!result.ok || result.duplicate) return;
  assert.equal(result.periodStart.getTime(), trialEndsAt.getTime());
  assert.equal(
    result.periodEnd.getTime(),
    trialEndsAt.getTime() + 30 * 24 * 60 * 60 * 1000,
  );
  assert.equal(fake.updates[0].values.subscriptionExpiresAt, result.periodEnd);
});

test("recordVerifiedPayment starts after the later trial and paid expiry", async () => {
  const now = new Date("2026-10-25T00:00:00.000Z");
  const trialEndsAt = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
  const subscriptionExpiresAt = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
  const fake = createMemoryDatabase(
    [
      [studentRow({ trialEndsAt, subscriptionExpiresAt })],
      [{ revenueShareBps: 3000 }],
    ],
    [[{ id: "subscription-a" }]],
  );

  const result = await recordVerifiedPayment(paymentInput(), fake.database, now);

  assert.equal(result.ok, true);
  if (!result.ok || result.duplicate) return;
  assert.equal(result.periodStart.getTime(), subscriptionExpiresAt.getTime());
  assert.equal(fake.updates[0].values.subscriptionExpiresAt, result.periodEnd);
});

test("recordVerifiedPayment supports a zero university share", async () => {
  const now = new Date("2026-10-25T00:00:00.000Z");
  const fake = createMemoryDatabase(
    [[studentRow()], [{ revenueShareBps: 0 }]],
    [[{ id: "subscription-a" }]],
  );

  const result = await recordVerifiedPayment(paymentInput(), fake.database, now);

  assert.equal(result.ok, true);
  if (!result.ok || result.duplicate) return;
  assert.equal(result.universityAmount, 0);
  assert.equal(result.platformAmount, 1000);
});

test("recordVerifiedPayment accepts a matching duplicate without updating the user", async () => {
  const fake = createMemoryDatabase(
    [
      [studentRow()],
      [{ revenueShareBps: 3000 }],
      [{ userId: "student-a", amount: 1000 }],
    ],
    [[]],
  );

  assert.deepEqual(await recordVerifiedPayment(paymentInput(), fake.database), {
    ok: true,
    duplicate: true,
  });
  assert.deepEqual(fake.updates, []);
});

test("recordVerifiedPayment rejects a conflicting transaction without updating the user", async () => {
  const fake = createMemoryDatabase(
    [
      [studentRow()],
      [{ revenueShareBps: 3000 }],
      [{ userId: "student-b", amount: 1000 }],
    ],
    [[]],
  );

  assert.deepEqual(await recordVerifiedPayment(paymentInput(), fake.database), {
    ok: false,
    reason: "transaction_conflict",
  });
  assert.deepEqual(fake.updates, []);
});
