import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  ADMIN_SUPER_LOGIN_OAUTH_START_TICKET_TTL_MS,
  ADMIN_SUPER_LOGIN_OAUTH_TRANSACTION_TTL_MS,
  ADMIN_SUPER_LOGIN_OAUTH_TRANSFER_CODE_TTL_MS,
  createAdminSuperLoginOauthService,
  type AdminSuperLoginOauthRepository,
} from "../src/admin-super-login-oauth";

const NOW = new Date("2026-12-01T10:00:00.000Z");
const TRANSACTION_ID = "super-login-transaction-1";
const USER_ID = "invited-editor-1";
const RAW_VALUE = Buffer.from("0123456789abcdef0123456789abcdef").toString("base64url");
const hash = (purpose: string, value: string) =>
  createHash("sha256").update(`super-login:${purpose}:${value}`).digest("hex");

function createService() {
  let startTicketHash: string | null = null;
  let startExpiresAt: Date | null = null;
  let startConsumed = false;
  let transactionExpiresAt: Date | null = null;
  let boundUserId: string | null = null;
  let transferCodeHash: string | null = null;
  let transferExpiresAt: Date | null = null;
  let transferConsumed = false;
  const calls = {
    created: [] as Array<{ startTicketHash: string; expiresAt: Date; now: Date }>,
    checked: [] as Array<{
      transactionId: string;
      email: string;
      providerAccountId: string;
      now: Date;
    }>,
  };

  const repository: AdminSuperLoginOauthRepository = {
    async createStartTicket(input) {
      calls.created.push(input);
      startTicketHash = input.startTicketHash;
      startExpiresAt = input.expiresAt;
      return { transactionId: TRANSACTION_ID };
    },
    async consumeStartTicket(ticketHash, now, expiresAt) {
      if (
        ticketHash !== startTicketHash
        || startConsumed
        || startExpiresAt === null
        || startExpiresAt <= now
      ) {
        return null;
      }
      startConsumed = true;
      transactionExpiresAt = expiresAt;
      return { transactionId: TRANSACTION_ID };
    },
    async checkGoogleEligibility(input) {
      calls.checked.push(input);
      if (
        input.transactionId !== TRANSACTION_ID
        || input.email !== "editor@example.test"
        || input.providerAccountId !== "google-account-1"
        || transactionExpiresAt === null
        || transactionExpiresAt <= input.now
        || transferCodeHash !== null
      ) {
        return { ok: false, userId: null };
      }
      if (boundUserId !== null && boundUserId !== USER_ID) {
        return { ok: false, userId: null };
      }
      boundUserId = USER_ID;
      return { ok: true, userId: USER_ID };
    },
    async createTransferCode(input) {
      if (
        input.transactionId !== TRANSACTION_ID
        || input.userId !== boundUserId
        || transferCodeHash !== null
      ) {
        return false;
      }
      transferCodeHash = input.transferCodeHash;
      transferExpiresAt = input.transferExpiresAt;
      return true;
    },
    async consumeTransferCode(codeHash, now) {
      if (
        codeHash !== transferCodeHash
        || transferConsumed
        || transferExpiresAt === null
        || transferExpiresAt <= now
        || boundUserId === null
      ) {
        return null;
      }
      transferConsumed = true;
      return { userId: boundUserId };
    },
  };

  const service = createAdminSuperLoginOauthService({
    repository,
    now: () => new Date(NOW),
    randomBytes: (size) => {
      assert.equal(size, 32);
      return Buffer.from("0123456789abcdef0123456789abcdef");
    },
  });
  return { calls, service };
}

test("super-admin Google login uses an opaque short-lived one-time start ticket", async () => {
  const { calls, service } = createService();
  assert.equal(await service.createAdminSuperLoginOauthStartTicket(), RAW_VALUE);
  assert.deepEqual(calls.created, [{
    startTicketHash: hash("start", RAW_VALUE),
    expiresAt: new Date(NOW.getTime() + ADMIN_SUPER_LOGIN_OAUTH_START_TICKET_TTL_MS),
    now: NOW,
  }]);
  assert.notEqual(calls.created[0].startTicketHash, RAW_VALUE);
  assert.deepEqual(
    await service.consumeAdminSuperLoginOauthStartTicket(RAW_VALUE),
    { transactionId: TRANSACTION_ID },
  );
  assert.equal(await service.consumeAdminSuperLoginOauthStartTicket(RAW_VALUE), null);
});

test("super-admin Google login binds only the active invited identity and transfers once", async () => {
  const { calls, service } = createService();
  await service.createAdminSuperLoginOauthStartTicket();
  await service.consumeAdminSuperLoginOauthStartTicket(RAW_VALUE);

  assert.deepEqual(
    await service.checkAdminSuperLoginGoogleEligibility({
      transactionId: TRANSACTION_ID,
      email: " Editor@Example.Test ",
      providerAccountId: "google-account-1",
    }),
    { ok: true, userId: USER_ID },
  );
  assert.deepEqual(calls.checked, [{
    transactionId: TRANSACTION_ID,
    email: "editor@example.test",
    providerAccountId: "google-account-1",
    now: NOW,
  }]);
  assert.deepEqual(
    await service.checkAdminSuperLoginGoogleEligibility({
      transactionId: TRANSACTION_ID,
      email: "editor@example.test",
      providerAccountId: "different-google-account",
    }),
    { ok: false, userId: null },
  );

  assert.equal(
    await service.createAdminSuperLoginOauthTransferCode({
      transactionId: TRANSACTION_ID,
      userId: USER_ID,
    }),
    RAW_VALUE,
  );
  assert.deepEqual(await service.consumeAdminSuperLoginOauthTransferCode(RAW_VALUE), {
    userId: USER_ID,
  });
  assert.equal(await service.consumeAdminSuperLoginOauthTransferCode(RAW_VALUE), null);
  assert.equal(
    ADMIN_SUPER_LOGIN_OAUTH_TRANSACTION_TTL_MS,
    15 * 60 * 1000,
  );
  assert.equal(
    ADMIN_SUPER_LOGIN_OAUTH_TRANSFER_CODE_TTL_MS,
    60 * 1000,
  );
});
