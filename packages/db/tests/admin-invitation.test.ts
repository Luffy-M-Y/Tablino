import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  createAdminInvitationStepUpVerifier,
  createAdminInvitationService,
  getAdminInvitationQuotaWindowStart,
  hasReachedAdminInvitationQuota,
  hashAdminInvitationToken,
  isValidInvitationToken,
  normalizeAdminInvitationEmail,
  ADMIN_INVITATION_AUDIT_RETENTION_MONTHS,
  ADMIN_INVITATION_TTL_MS,
  type AdminInvitationStepUpVerifierDependencies,
  type AdminInvitationRepository,
  type AdminInvitationRole,
} from "../src/admin-invitation";
import { RATE_LIMITS } from "../src/auth-attempts";

const NOW = new Date("2026-11-14T12:00:00.000Z");
const INVITER_ID = "super-admin-id";
const BASE_TOKEN = Buffer.alloc(32, 7).toString("base64url");

type CreatedInput = Parameters<AdminInvitationRepository["create"]>[0];

function createService(
  create: AdminInvitationRepository["create"],
) {
  let tokenSeed = 0;
  const service = createAdminInvitationService({
    repository: {
      create,
      revoke: async () => true,
    },
    now: () => new Date(NOW),
    randomBytes: (size) => Buffer.alloc(size, ++tokenSeed),
  });
  return service;
}

function createRepository(
  resolve: (input: CreatedInput) => Promise<
    | { invitationId: string; auditId: string; role: AdminInvitationRole }
    | "account_exists"
    | "inviter_not_allowed"
    | "quota_exceeded"
  > = async (input) => ({
    invitationId: "invitation-id",
    auditId: "audit-id",
    role: input.role,
  }),
) {
  const inputs: CreatedInput[] = [];
  const repository: AdminInvitationRepository = {
    async create(input) {
      inputs.push(input);
      return resolve(input);
    },
    async revoke() {
      return true;
    },
  };
  return { inputs, repository };
}

test("normalizes a valid invitation email", () => {
  assert.equal(normalizeAdminInvitationEmail("  Reader@Example.com "), "reader@example.com");
});

test("rejects malformed invitation emails before repository access", async () => {
  let createCalls = 0;
  const service = createService(async () => {
    createCalls++;
    return "account_exists";
  });

  assert.deepEqual(
    await service.createAdminInvitation("not-an-email", INVITER_ID, "super_admin_lector", null),
    { ok: false, reason: "invalid_email" },
  );
  assert.equal(createCalls, 0);
});

test("creates a 32-byte token, stores only its hash, role, IP, and 48-hour expiry", async () => {
  const fake = createRepository();
  const service = createAdminInvitationService({
    repository: fake.repository,
    now: () => new Date(NOW),
    randomBytes: (size) => Buffer.alloc(size, 7),
  });

  const result = await service.createAdminInvitation(
    "Reader@Example.com",
    INVITER_ID,
    "super_admin_lector",
    "192.0.2.10",
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.email, "reader@example.com");
  assert.equal(result.role, "super_admin_lector");
  assert.equal(result.auditId, "audit-id");
  assert.equal(Buffer.from(result.token, "base64url").length, 32);
  assert.equal(fake.inputs[0].tokenHash, hashAdminInvitationToken(result.token));
  assert.notEqual(fake.inputs[0].tokenHash, result.token);
  assert.equal(fake.inputs[0].role, "super_admin_lector");
  assert.equal(fake.inputs[0].clientIp, "192.0.2.10");
  assert.equal(fake.inputs[0].expiresAt.getTime(), NOW.getTime() + ADMIN_INVITATION_TTL_MS);
  assert.equal(
    fake.inputs[0].auditExpiresAt.toISOString(),
    "2027-11-14T12:00:00.000Z",
  );
  assert.equal(ADMIN_INVITATION_AUDIT_RETENTION_MONTHS, 12);
});

test("creates either invitation role from the stored role input", async () => {
  const service = createService(async (input) => ({
    invitationId: `invitation-${input.role}`,
    auditId: `audit-${input.role}`,
    role: input.role,
  }));

  for (const role of ["super_admin_editor", "super_admin_lector"] as const) {
    const result = await service.createAdminInvitation(
      `${role}@example.test`,
      INVITER_ID,
      role,
      null,
    );
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.role, role);
  }
});

test("clamps twelve-month audit retention to the last valid UTC day", async () => {
  const leapDay = new Date("2024-02-29T12:00:00.000Z");
  const captured: { auditExpiresAt?: Date } = {};
  const service = createAdminInvitationService({
    repository: {
      async create(input) {
        captured.auditExpiresAt = input.auditExpiresAt;
        return {
          invitationId: "invitation-id",
          auditId: "audit-id",
          role: input.role,
        };
      },
      async revoke() {
        return true;
      },
    },
    now: () => leapDay,
  });

  await service.createAdminInvitation(
    "reader@example.test",
    INVITER_ID,
    "super_admin_lector",
    null,
  );
  assert.equal(captured.auditExpiresAt?.toISOString(), "2025-02-28T12:00:00.000Z");
});

test("rejects roles outside the invitation allowlist", async () => {
  let createCalls = 0;
  const service = createService(async () => {
    createCalls++;
    return "account_exists";
  });

  assert.deepEqual(
    await service.createAdminInvitation(
      "reader@example.test",
      INVITER_ID,
      "super_admin",
      null,
    ),
    { ok: false, reason: "invalid_role" },
  );
  assert.equal(createCalls, 0);
});

test("propagates account, inviter, and sliding-quota denials", async () => {
  for (const reason of ["account_exists", "inviter_not_allowed", "quota_exceeded"] as const) {
    const service = createService(async () => reason);
    assert.deepEqual(
      await service.createAdminInvitation(
        "reader@example.test",
        INVITER_ID,
        "super_admin_lector",
        null,
      ),
      { ok: false, reason },
    );
  }
});

test("uses a rolling one-hour window and blocks at the tenth invitation", () => {
  assert.equal(
    getAdminInvitationQuotaWindowStart(NOW).toISOString(),
    "2026-11-14T11:00:00.000Z",
  );
  assert.equal(hasReachedAdminInvitationQuota(9), false);
  assert.equal(hasReachedAdminInvitationQuota(10), true);
});

test("token hashes are SHA-256 digests", () => {
  assert.equal(
    hashAdminInvitationToken(BASE_TOKEN),
    createHash("sha256").update(BASE_TOKEN).digest("hex"),
  );
});

test("invitation token validation accepts only canonical 32-byte base64url values", () => {
  assert.equal(isValidInvitationToken(BASE_TOKEN), true);
  assert.equal(isValidInvitationToken("invalid"), false);
  assert.equal(isValidInvitationToken(Buffer.alloc(31, 7).toString("base64url")), false);
});

test("five failed editor step-ups block even the correct password", async () => {
  const failures = new Map<string, number>();
  const calls: Array<[string, string]> = [];
  let passwordChecks = 0;
  const dependencies: AdminInvitationStepUpVerifierDependencies = {
    async checkRateLimit(action, identifier) {
      calls.push([action, identifier]);
      return { allowed: (failures.get(identifier) ?? 0) < RATE_LIMITS.login.maxAttempts };
    },
    async recordFailure(action, identifier) {
      calls.push([action, identifier]);
      failures.set(identifier, (failures.get(identifier) ?? 0) + 1);
    },
    verifyPassword(password) {
      passwordChecks++;
      return password === "correct-password";
    },
  };
  const verify = createAdminInvitationStepUpVerifier(dependencies);

  assert.deepEqual(RATE_LIMITS.login, {
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000,
    blockMs: 15 * 60 * 1000,
  });
  for (let attempt = 0; attempt < 5; attempt++) {
    assert.deepEqual(await verify("inviter-1", "wrong-password", "hash"), {
      ok: false,
      reason: "invalid_password",
    });
  }
  assert.deepEqual(await verify("inviter-1", "correct-password", "hash"), {
    ok: false,
    reason: "rate_limited",
  });
  assert.equal(passwordChecks, 5);
  assert.equal(failures.get("admin-invitation-editor:inviter-1"), 5);
});

test("editor step-up failure counters are isolated per inviter account", async () => {
  const failures = new Map<string, number>();
  const verify = createAdminInvitationStepUpVerifier({
    async checkRateLimit(_action, identifier) {
      return { allowed: (failures.get(identifier) ?? 0) < RATE_LIMITS.login.maxAttempts };
    },
    async recordFailure(_action, identifier) {
      failures.set(identifier, (failures.get(identifier) ?? 0) + 1);
    },
    verifyPassword: (password) => password === "correct-password",
  });

  for (let attempt = 0; attempt < 5; attempt++) {
    await verify("inviter-1", "wrong-password", "hash");
  }

  assert.deepEqual(await verify("inviter-1", "correct-password", "hash"), {
    ok: false,
    reason: "rate_limited",
  });
  assert.deepEqual(await verify("inviter-2", "correct-password", "hash"), {
    ok: true,
  });
  assert.equal(failures.get("admin-invitation-editor:inviter-2"), undefined);
});
