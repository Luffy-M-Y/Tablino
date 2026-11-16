import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  createAdminInvitationService,
  hashAdminInvitationToken,
  normalizeAdminInvitationEmail,
  ADMIN_INVITATION_TTL_MS,
  type AdminInvitationRepository,
  type AdminInvitationRole,
} from "../src/admin-invitation";

const NOW = new Date("2026-11-14T12:00:00.000Z");
const INVITER_ID = "super-admin-id";
const BASE_TOKEN = Buffer.alloc(32, 7).toString("base64url");
const VALID_PASSWORD = "StrongPassword1";

type StoredInvitation = {
  invitationId: string;
  email: string;
  role: AdminInvitationRole;
  invitedByUserId: string;
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
  consumedAt: Date | null;
  revokedAt: Date | null;
  acceptedUserId: string | null;
};

type StoredUser = {
  id: string;
  email: string;
  role: AdminInvitationRole;
  emailVerified: Date;
  passwordHash: string;
  universityId: null;
};

function createMemoryRepository({
  existingEmails = [] as string[],
  allowedInviterIds = [INVITER_ID],
}: {
  existingEmails?: string[];
  allowedInviterIds?: string[];
} = {}) {
  const invitations: StoredInvitation[] = [];
  const users: StoredUser[] = [];
  const accountEmails = new Set(existingEmails.map((email) => email.toLowerCase()));
  const allowedInviters = new Set(allowedInviterIds);
  let nextInvitationId = 0;
  let nextUserId = 0;

  const repository: AdminInvitationRepository = {
    async create(input) {
      if (!allowedInviters.has(input.invitedByUserId)) return "inviter_not_allowed";
      if (accountEmails.has(input.email)) return "account_exists";

      for (const invitation of invitations) {
        if (
          invitation.email === input.email
          && invitation.consumedAt === null
          && invitation.revokedAt === null
        ) {
          invitation.revokedAt = input.createdAt;
        }
      }

      const invitationId = `invitation-${++nextInvitationId}`;
      invitations.push({
        ...input,
        invitationId,
        consumedAt: null,
        revokedAt: null,
        acceptedUserId: null,
      });
      return { invitationId, role: input.role };
    },
    async revoke(invitationId, revokedAt) {
      const invitation = invitations.find((item) => item.invitationId === invitationId);
      if (
        !invitation
        || invitation.consumedAt !== null
        || invitation.revokedAt !== null
      ) {
        return false;
      }
      invitation.revokedAt = revokedAt;
      return true;
    },
    async consume({ tokenHash, passwordHash, now }) {
      const invitation = invitations.find((item) =>
        item.tokenHash === tokenHash
        && item.consumedAt === null
        && item.revokedAt === null
        && item.expiresAt > now,
      );
      if (!invitation) return null;

      invitation.consumedAt = now;
      if (accountEmails.has(invitation.email)) return null;

      const user: StoredUser = {
        id: `admin-${++nextUserId}`,
        email: invitation.email,
        role: invitation.role,
        emailVerified: now,
        passwordHash,
        universityId: null,
      };
      users.push(user);
      accountEmails.add(invitation.email);
      invitation.acceptedUserId = user.id;
      return invitation.role;
    },
  };

  return { repository, invitations, users, accountEmails };
}

function createService(options: Parameters<typeof createMemoryRepository>[0] = {}) {
  const fake = createMemoryRepository(options);
  let randomCounter = 0;
  const service = createAdminInvitationService({
    repository: fake.repository,
    now: () => new Date(NOW),
    randomBytes: (size) => Buffer.alloc(size, ++randomCounter),
    hashPassword: (password) => `test-hash:${password}`,
  });
  return Object.assign(fake, { service });
}

test("normalizes a valid invitation email", () => {
  assert.equal(normalizeAdminInvitationEmail("  Reader@Example.com "), "reader@example.com");
});

test("rejects malformed invitation emails", async () => {
  const fake = createService();

  assert.deepEqual(
    await fake.service.createAdminInvitation("not-an-email", INVITER_ID),
    { ok: false, reason: "invalid_email" },
  );
  assert.deepEqual(fake.invitations, []);
});

test("creates an invitation with a random token and stores only its hash", async () => {
  const fake = createService();

  const result = await fake.service.createAdminInvitation("Reader@Example.com", INVITER_ID);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.email, "reader@example.com");
  assert.equal(result.role, "super_admin_lector");
  assert.equal(Buffer.from(result.token, "base64url").length, 32);
  assert.equal(fake.invitations.length, 1);
  assert.equal(fake.invitations[0].tokenHash, hashAdminInvitationToken(result.token));
  assert.notEqual(fake.invitations[0].tokenHash, result.token);
  assert.equal(fake.invitations[0].expiresAt.getTime(), NOW.getTime() + ADMIN_INVITATION_TTL_MS);
  assert.equal(fake.invitations[0].role, "super_admin_lector");
  assert.equal(fake.invitations[0].invitedByUserId, INVITER_ID);
});

test("reports an already registered email without issuing a token", async () => {
  const fake = createService({ existingEmails: ["reader@example.com"] });

  assert.deepEqual(
    await fake.service.createAdminInvitation("reader@example.com", INVITER_ID),
    { ok: false, reason: "account_exists" },
  );
  assert.deepEqual(fake.invitations, []);
});

test("refuses an inviter not authorized to manage invitations", async () => {
  const fake = createService({ allowedInviterIds: [] });

  assert.deepEqual(
    await fake.service.createAdminInvitation("reader@example.com", INVITER_ID),
    { ok: false, reason: "inviter_not_allowed" },
  );
  assert.deepEqual(fake.invitations, []);
});

test("reissuing an invitation invalidates the previous pending token", async () => {
  const fake = createService();
  const first = await fake.service.createAdminInvitation("reader@example.com", INVITER_ID);
  const second = await fake.service.createAdminInvitation("reader@example.com", INVITER_ID);

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(fake.invitations.length, 2);
  assert.equal(fake.invitations[0].revokedAt?.getTime(), NOW.getTime());
  assert.equal(fake.invitations[1].revokedAt, null);
});

test("revokes a pending invitation by identifier", async () => {
  const fake = createService();
  const created = await fake.service.createAdminInvitation("reader@example.com", INVITER_ID);
  assert.equal(created.ok, true);
  if (!created.ok) return;

  assert.equal(await fake.service.revokeAdminInvitation(created.invitationId), true);
  assert.equal(fake.invitations[0].revokedAt?.getTime(), NOW.getTime());
  assert.equal(await fake.service.revokeAdminInvitation(created.invitationId), false);
});

test("consumes a valid invitation and creates a verified lector with a hashed password", async () => {
  const fake = createService();
  const created = await fake.service.createAdminInvitation("reader@example.com", INVITER_ID);
  assert.equal(created.ok, true);
  if (!created.ok) return;

  assert.deepEqual(
    await fake.service.consumeAdminInvitation(created.token, VALID_PASSWORD),
    { ok: true, role: "super_admin_lector" },
  );
  assert.deepEqual(fake.users, [{
    id: "admin-1",
    email: "reader@example.com",
    role: "super_admin_lector",
    emailVerified: NOW,
    passwordHash: `test-hash:${VALID_PASSWORD}`,
    universityId: null,
  }]);
  assert.equal(fake.invitations[0].consumedAt?.getTime(), NOW.getTime());
  assert.equal(fake.invitations[0].acceptedUserId, "admin-1");
});

test("acceptance creates the user with the role stored on the invitation", async () => {
  const fake = createService();
  const created = await fake.service.createAdminInvitation("reader@example.com", INVITER_ID);
  assert.equal(created.ok, true);
  if (!created.ok) return;

  fake.invitations[0].role = "super_admin_editor";
  assert.deepEqual(
    await fake.service.consumeAdminInvitation(created.token, VALID_PASSWORD),
    { ok: true, role: "super_admin_editor" },
  );
  assert.equal(fake.users[0].role, "super_admin_editor");
});

test("rejects an invalid password without consuming the invitation", async () => {
  const fake = createService();
  const created = await fake.service.createAdminInvitation("reader@example.com", INVITER_ID);
  assert.equal(created.ok, true);
  if (!created.ok) return;

  assert.deepEqual(
    await fake.service.consumeAdminInvitation(created.token, "short"),
    { ok: false, reason: "invalid_password" },
  );
  assert.equal(fake.invitations[0].consumedAt, null);
  assert.deepEqual(fake.users, []);
});

test("returns the generic unavailable result for a malformed token", async () => {
  const fake = createService();

  assert.deepEqual(
    await fake.service.consumeAdminInvitation("invalid", VALID_PASSWORD),
    { ok: false, reason: "invitation_unavailable" },
  );
  assert.deepEqual(fake.users, []);
});

test("unknown, expired, revoked, and consumed tokens have the same failure result", async () => {
  const fake = createService();
  const created = await fake.service.createAdminInvitation("reader@example.com", INVITER_ID);
  assert.equal(created.ok, true);
  if (!created.ok) return;

  const unavailable = { ok: false, reason: "invitation_unavailable" };
  assert.deepEqual(
    await fake.service.consumeAdminInvitation(BASE_TOKEN, VALID_PASSWORD),
    unavailable,
  );

  fake.invitations[0].expiresAt = new Date(NOW.getTime());
  assert.deepEqual(
    await fake.service.consumeAdminInvitation(created.token, VALID_PASSWORD),
    unavailable,
  );

  fake.invitations[0].expiresAt = new Date(NOW.getTime() + ADMIN_INVITATION_TTL_MS);
  fake.invitations[0].revokedAt = NOW;
  assert.deepEqual(
    await fake.service.consumeAdminInvitation(created.token, VALID_PASSWORD),
    unavailable,
  );

  fake.invitations[0].revokedAt = null;
  fake.invitations[0].consumedAt = NOW;
  assert.deepEqual(
    await fake.service.consumeAdminInvitation(created.token, VALID_PASSWORD),
    unavailable,
  );
});

test("does not create or alter an account when the invitation email is already registered", async () => {
  const fake = createService({ existingEmails: ["reader@example.com"] });
  const created = await fake.service.createAdminInvitation("other@example.com", INVITER_ID);
  assert.equal(created.ok, true);
  if (!created.ok) return;

  fake.accountEmails.add("other@example.com");
  assert.deepEqual(
    await fake.service.consumeAdminInvitation(created.token, VALID_PASSWORD),
    { ok: false, reason: "invitation_unavailable" },
  );
  assert.deepEqual(fake.users, []);
});

test("a consumed token cannot be replayed", async () => {
  const fake = createService();
  const created = await fake.service.createAdminInvitation("reader@example.com", INVITER_ID);
  assert.equal(created.ok, true);
  if (!created.ok) return;

  assert.deepEqual(
    await fake.service.consumeAdminInvitation(created.token, VALID_PASSWORD),
    { ok: true, role: "super_admin_lector" },
  );
  assert.deepEqual(
    await fake.service.consumeAdminInvitation(created.token, VALID_PASSWORD),
    { ok: false, reason: "invitation_unavailable" },
  );
  assert.equal(fake.users.length, 1);
});

test("only one of two concurrent consumers can accept the same token", async () => {
  const fake = createService();
  const created = await fake.service.createAdminInvitation("reader@example.com", INVITER_ID);
  assert.equal(created.ok, true);
  if (!created.ok) return;

  const results = await Promise.all([
    fake.service.consumeAdminInvitation(created.token, VALID_PASSWORD),
    fake.service.consumeAdminInvitation(created.token, VALID_PASSWORD),
  ]);

  assert.deepEqual(results, [
    { ok: true, role: "super_admin_lector" },
    { ok: false, reason: "invitation_unavailable" },
  ]);
  assert.equal(fake.users.length, 1);
});

test("token hashes are SHA-256 digests", () => {
  assert.equal(
    hashAdminInvitationToken(BASE_TOKEN),
    createHash("sha256").update(BASE_TOKEN).digest("hex"),
  );
});
