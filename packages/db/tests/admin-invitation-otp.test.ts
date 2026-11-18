import assert from "node:assert/strict";
import test from "node:test";
import * as schema from "../src/schema";
import {
  consumeAdminInvitationCode,
  generateAdminInvitationCode,
  hashAdminInvitationCode,
  startAdminInvitationAcceptance,
} from "../src/admin-invitation-otp";
import { hashAdminInvitationToken } from "../src/admin-invitation";

const TOKEN = Buffer.alloc(32, 8).toString("base64url");
const CODE = "123456";
const NOW = new Date("2026-11-14T12:00:00.000Z");

test("generates six-digit OTP codes", () => {
  const code = generateAdminInvitationCode();
  assert.match(code, /^\d{6}$/);
});

test("mismatched passwords do not create or write an OTP", async () => {
  let transactionCalls = 0;
  const database = {
    async transaction() {
      transactionCalls += 1;
      throw new Error("A transaction must not start for mismatched passwords.");
    },
  } as never;

  assert.deepEqual(
    await startAdminInvitationAcceptance(
      TOKEN,
      "A-strong-password",
      "different-password",
      NOW,
      database,
    ),
    { ok: false, reason: "password_mismatch" },
  );
  assert.equal(transactionCalls, 0);
});

function createMemoryDatabase({
  invitationRole = "super_admin_editor",
  code = CODE,
  attempts = 0,
  expiresAt = new Date(NOW.getTime() + 10 * 60 * 1000),
}: {
  invitationRole?: "super_admin_editor" | "super_admin_lector";
  code?: string;
  attempts?: number;
  expiresAt?: Date;
} = {}) {
  const invitation = {
    id: "invitation-id",
    email: "editor@example.test",
    role: invitationRole,
    tokenHash: hashAdminInvitationToken(TOKEN),
    consumedAt: null as Date | null,
    revokedAt: null as Date | null,
    expiresAt: new Date(NOW.getTime() + 48 * 60 * 60 * 1000),
  };
  const codeRow = {
    id: "code-id",
    invitationId: invitation.id,
    codeHash: hashAdminInvitationCode(TOKEN, code),
    passwordHash: "temporary-password-hash",
    attempts,
    expiresAt,
    consumedAt: null as Date | null,
  };
  const insertedUsers: Record<string, unknown>[] = [];

  const tx = {
    select: () => {
      let table: unknown;
      const query = {
        from(value: unknown) {
          table = value;
          return query;
        },
        where() {
          return query;
        },
        for() {
          return query;
        },
        async limit() {
          if (table === schema.adminInvitations) return [invitation];
          if (table === schema.adminInvitationCodes) return [codeRow];
          return [];
        },
      };
      return query;
    },
    update: (table: unknown) => {
      let values: Record<string, unknown> = {};
      let returned: unknown[] = [];
      const chain = {
        set(nextValues: Record<string, unknown>) {
          values = nextValues;
          return chain;
        },
        where() {
          if (table === schema.adminInvitationCodes) Object.assign(codeRow, values);
          if (table === schema.adminInvitations) Object.assign(invitation, values);
          if (table === schema.adminInvitations) returned = [{ id: invitation.id }];
          return chain;
        },
        async returning() {
          return returned;
        },
        then(
          onFulfilled?: ((value: unknown) => unknown) | null,
          onRejected?: ((reason: unknown) => unknown) | null,
        ) {
          return Promise.resolve(undefined).then(onFulfilled, onRejected);
        },
      };
      return chain;
    },
    insert: (table: unknown) => {
      let values: Record<string, unknown> = {};
      const chain = {
        values(nextValues: Record<string, unknown>) {
          values = nextValues;
          return chain;
        },
        onConflictDoNothing() {
          return chain;
        },
        async returning() {
          if (table === schema.users) {
            insertedUsers.push(values);
            return [{ id: "new-user-id" }];
          }
          return [];
        },
        then(
          onFulfilled?: ((value: unknown) => unknown) | null,
          onRejected?: ((reason: unknown) => unknown) | null,
        ) {
          return Promise.resolve(undefined).then(onFulfilled, onRejected);
        },
      };
      return chain;
    },
  };

  const database = {
    transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) =>
      callback(tx),
  } as never;

  return { database, insertedUsers, invitation, codeRow };
}

test("the account is created only after a valid code and receives the stored invitation role", async () => {
  const fake = createMemoryDatabase({ invitationRole: "super_admin_editor" });

  const result = await consumeAdminInvitationCode(TOKEN, CODE, NOW, fake.database);

  assert.deepEqual(result, { ok: true, role: "super_admin_editor" });
  assert.deepEqual(fake.insertedUsers, [{
    email: "editor@example.test",
    emailVerified: NOW,
    passwordHash: "temporary-password-hash",
    role: "super_admin_editor",
    universityId: null,
  }]);
  assert.equal(fake.invitation.consumedAt, NOW);
  assert.equal(fake.codeRow.consumedAt, NOW);
});

test("an invalid code increments attempts but never creates an account", async () => {
  const fake = createMemoryDatabase();

  assert.deepEqual(
    await consumeAdminInvitationCode(TOKEN, "999999", NOW, fake.database),
    { ok: false, reason: "invalid_code" },
  );
  assert.equal(fake.codeRow.attempts, 1);
  assert.deepEqual(fake.insertedUsers, []);
});

test("an expired or exhausted OTP cannot create an account", async () => {
  const expired = createMemoryDatabase({
    expiresAt: new Date(NOW.getTime()),
  });
  const exhausted = createMemoryDatabase({ attempts: 5 });

  assert.deepEqual(
    await consumeAdminInvitationCode(TOKEN, CODE, NOW, expired.database),
    { ok: false, reason: "code_unavailable" },
  );
  assert.deepEqual(
    await consumeAdminInvitationCode(TOKEN, CODE, NOW, exhausted.database),
    { ok: false, reason: "code_unavailable" },
  );
  assert.deepEqual(expired.insertedUsers, []);
  assert.deepEqual(exhausted.insertedUsers, []);
});
