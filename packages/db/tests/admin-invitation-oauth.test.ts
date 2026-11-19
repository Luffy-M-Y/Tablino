import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  ADMIN_INVITATION_OAUTH_START_TICKET_TTL_MS,
  ADMIN_INVITATION_OAUTH_TRANSACTION_TTL_MS,
  ADMIN_INVITATION_OAUTH_TRANSFER_CODE_TTL_MS,
  createAdminInvitationOauthService,
  type AdminInvitationOauthRepository,
} from "../src/admin-invitation-oauth";

const NOW = new Date("2026-12-01T10:00:00.000Z");
const INVITATION_ID = "invitation-1";
const TRANSACTION_ID = "oauth-transaction-1";
const USER_ID = "pending-user-1";
const INVITATION_TOKEN = Buffer.from("0123456789abcdef0123456789abcdef").toString("base64url");
const RAW_TICKET = Buffer.from("0123456789abcdef0123456789abcdef").toString("base64url");
const RAW_TRANSFER_CODE = RAW_TICKET;
const hash = (purpose: string, value: string) =>
  createHash("sha256").update(`${purpose}:${value}`).digest("hex");

function createFakeRepository() {
  let validInvitation = true;
  let pendingUserId: string | null = null;
  let completedAccount: { userId: string; providerAccountId: string } | null = null;
  let transferHash: string | null = null;
  let transferExpiresAt: Date | null = null;
  let transferConsumed = false;
  let startConsumed = false;
  let transactionExpiresAt = new Date(NOW.getTime() + ADMIN_INVITATION_OAUTH_START_TICKET_TTL_MS);
  const calls = {
    createdStartTicket: [] as Array<{ invitationTokenHash: string; startTicketHash: string; expiresAt: Date }>,
    consumedStartTicket: [] as string[],
    eligibility: [] as Array<{ invitationId: string; transactionId: string; email: string }>,
    completedAccounts: [] as Array<{ invitationId: string; transactionId: string; userId: string; providerAccountId: string; now: Date }>,
    createdTransfers: [] as Array<{ userId: string; transferCodeHash: string; transferExpiresAt: Date }>,
    consumedTransfers: [] as string[],
  };

  const repository: AdminInvitationOauthRepository = {
    async createStartTicket(input) {
      calls.createdStartTicket.push(input);
      if (!validInvitation) return null;
      return { invitationId: INVITATION_ID, transactionId: TRANSACTION_ID };
    },
    async consumeStartTicket(startTicketHash, now, expiresAt) {
      calls.consumedStartTicket.push(startTicketHash);
      if (
        startTicketHash !== hash("start", RAW_TICKET)
        || startConsumed
        || transactionExpiresAt <= now
      ) {
        return null;
      }
      startConsumed = true;
      transactionExpiresAt = expiresAt;
      return { invitationId: INVITATION_ID, transactionId: TRANSACTION_ID };
    },
    async checkGoogleEligibility(input) {
      calls.eligibility.push(input);
      return {
        ok: validInvitation
          && input.invitationId === INVITATION_ID
          && input.transactionId === TRANSACTION_ID
          && input.email === "reader@example.test",
        pendingUserId,
      };
    },
    async createPendingGoogleUser(input) {
      if (!validInvitation || input.email !== "reader@example.test") return null;
      pendingUserId ??= USER_ID;
      return pendingUserId;
    },
    async completeGoogleAccount(input) {
      calls.completedAccounts.push(input);
      if (!validInvitation || input.userId !== pendingUserId) return false;
      completedAccount = {
        userId: input.userId,
        providerAccountId: input.providerAccountId,
      };
      return true;
    },
    async createTransferCode(input) {
      calls.createdTransfers.push(input);
      if (
        completedAccount?.userId !== input.userId
        || input.invitationId !== INVITATION_ID
        || input.transactionId !== TRANSACTION_ID
      ) {
        return false;
      }
      transferHash = input.transferCodeHash;
      transferExpiresAt = input.transferExpiresAt;
      return true;
    },
    async consumeTransferCode(transferCodeHash, now) {
      calls.consumedTransfers.push(transferCodeHash);
      if (
        transferCodeHash !== transferHash
        || transferConsumed
        || transferExpiresAt === null
        || transferExpiresAt <= now
        || completedAccount === null
      ) {
        return null;
      }
      transferConsumed = true;
      return { userId: completedAccount.userId };
    },
  };

  return {
    repository,
    calls,
    invalidateInvitation() {
      validInvitation = false;
    },
    get pendingUserId() {
      return pendingUserId;
    },
  };
}

function createService() {
  const fake = createFakeRepository();
  const service = createAdminInvitationOauthService({
    repository: fake.repository,
    now: () => new Date(NOW),
    randomBytes: (size) => {
      assert.equal(size, 32);
      return Buffer.from("0123456789abcdef0123456789abcdef");
    },
  });
  return Object.assign(fake, { service });
}

test("creates invitation OAuth tickets from valid tokens and stores only a scoped hash", async () => {
  const fake = createService();
  const ticket = await fake.service.createAdminInvitationOauthStartTicket(INVITATION_TOKEN);

  assert.equal(ticket, RAW_TICKET);
  assert.equal(fake.calls.createdStartTicket.length, 1);
  assert.equal(fake.calls.createdStartTicket[0].invitationTokenHash,
    createHash("sha256").update(INVITATION_TOKEN).digest("hex"));
  assert.equal(fake.calls.createdStartTicket[0].startTicketHash, hash("start", RAW_TICKET));
  assert.notEqual(fake.calls.createdStartTicket[0].startTicketHash, RAW_TICKET);
  assert.equal(
    fake.calls.createdStartTicket[0].expiresAt.getTime(),
    NOW.getTime() + ADMIN_INVITATION_OAUTH_START_TICKET_TTL_MS,
  );
});

test("consumes a start ticket once and extends its transaction only for the OAuth callback", async () => {
  const fake = createService();
  await fake.service.createAdminInvitationOauthStartTicket(INVITATION_TOKEN);

  assert.deepEqual(
    await fake.service.consumeAdminInvitationOauthStartTicket(RAW_TICKET),
    { invitationId: INVITATION_ID, transactionId: TRANSACTION_ID },
  );
  assert.equal(
    await fake.service.consumeAdminInvitationOauthStartTicket(RAW_TICKET),
    null,
  );
  assert.equal(fake.calls.consumedStartTicket.length, 2);
  assert.equal(
    fake.calls.consumedStartTicket[0],
    hash("start", RAW_TICKET),
  );
});

test("invalid invitation and malformed OAuth tickets fail closed before repository access", async () => {
  const fake = createService();
  assert.equal(await fake.service.createAdminInvitationOauthStartTicket("invalid"), null);
  assert.equal(await fake.service.consumeAdminInvitationOauthStartTicket("invalid"), null);
  assert.equal(fake.calls.createdStartTicket.length, 0);
  assert.equal(fake.calls.consumedStartTicket.length, 0);

  fake.invalidateInvitation();
  assert.equal(
    await fake.service.createAdminInvitationOauthStartTicket(INVITATION_TOKEN),
    null,
  );
});

test("Google eligibility normalizes email and creates a pending account only through its invitation transaction", async () => {
  const fake = createService();
  const eligibility = await fake.service.checkAdminInvitationGoogleEligibility({
    invitationId: INVITATION_ID,
    transactionId: TRANSACTION_ID,
    email: " Reader@Example.Test ",
  });
  assert.deepEqual(eligibility, { ok: true, pendingUserId: null });
  assert.deepEqual(fake.calls.eligibility[0], {
    invitationId: INVITATION_ID,
    transactionId: TRANSACTION_ID,
    email: "reader@example.test",
    now: NOW,
  });

  assert.equal(
    await fake.service.createPendingAdminInvitationGoogleUser({
      invitationId: INVITATION_ID,
      transactionId: TRANSACTION_ID,
      email: "reader@example.test",
      name: "Reader",
      image: null,
    }),
    USER_ID,
  );
  assert.equal(fake.pendingUserId, USER_ID);
});

test("Google account linking rejects other providers and uses only the pending invitation user", async () => {
  const fake = createService();
  await fake.service.createPendingAdminInvitationGoogleUser({
    invitationId: INVITATION_ID,
    transactionId: TRANSACTION_ID,
    email: "reader@example.test",
    name: null,
    image: null,
  });
  assert.equal(
    await fake.service.completeAdminInvitationGoogleAccount({
      invitationId: INVITATION_ID,
      transactionId: TRANSACTION_ID,
      userId: USER_ID,
      provider: "github",
      providerAccountId: "google-account",
    }),
    false,
  );
  assert.equal(fake.calls.completedAccounts.length, 0);
  assert.equal(
    await fake.service.completeAdminInvitationGoogleAccount({
      invitationId: INVITATION_ID,
      transactionId: TRANSACTION_ID,
      userId: USER_ID,
      provider: "google",
      providerAccountId: "google-account",
    }),
    true,
  );
  assert.deepEqual(fake.calls.completedAccounts[0], {
    invitationId: INVITATION_ID,
    transactionId: TRANSACTION_ID,
    userId: USER_ID,
    providerAccountId: "google-account",
    now: NOW,
  });
});

test("Google invitation transfer codes are hashed, short-lived, and single-use", async () => {
  const fake = createService();
  await fake.service.createPendingAdminInvitationGoogleUser({
    invitationId: INVITATION_ID,
    transactionId: TRANSACTION_ID,
    email: "reader@example.test",
    name: null,
    image: null,
  });
  await fake.service.completeAdminInvitationGoogleAccount({
    invitationId: INVITATION_ID,
    transactionId: TRANSACTION_ID,
    userId: USER_ID,
    provider: "google",
    providerAccountId: "google-account",
  });

  const code = await fake.service.createAdminInvitationOauthTransferCode({
    invitationId: INVITATION_ID,
    transactionId: TRANSACTION_ID,
    userId: USER_ID,
  });
  assert.equal(code, RAW_TRANSFER_CODE);
  assert.equal(fake.calls.createdTransfers[0].transferCodeHash, hash("transfer", RAW_TRANSFER_CODE));
  assert.notEqual(fake.calls.createdTransfers[0].transferCodeHash, RAW_TRANSFER_CODE);
  assert.equal(
    fake.calls.createdTransfers[0].transferExpiresAt.getTime(),
    NOW.getTime() + ADMIN_INVITATION_OAUTH_TRANSFER_CODE_TTL_MS,
  );
  assert.deepEqual(
    await fake.service.consumeAdminInvitationOauthTransferCode(RAW_TRANSFER_CODE),
    { userId: USER_ID },
  );
  assert.equal(
    await fake.service.consumeAdminInvitationOauthTransferCode(RAW_TRANSFER_CODE),
    null,
  );
});
