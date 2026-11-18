import assert from "node:assert/strict";
import test from "node:test";
import { runAdminInvitationFlow } from "../src/lib/admin-invitation-flow.mjs";

const CREATED = {
  ok: true,
  invitationId: "invitation-id",
  auditId: "audit-id",
  email: "reader@example.test",
  role: "super_admin_lector",
  token: Buffer.alloc(32, 5).toString("base64url"),
  expiresAt: new Date("2026-11-16T12:00:00.000Z"),
};

function dependencies(overrides = {}) {
  const calls = [];
  const createInvitation = overrides.createInvitation ?? (async () => CREATED);
  const sendEmail = overrides.sendEmail ?? (async () => {});
  const enqueueAlerts = overrides.enqueueAlerts ?? (async () => {});
  const processAlerts = overrides.processAlerts ?? (async () => {});
  return {
    calls,
    input: {
      email: "reader@example.test",
      invitedByUserId: "admin-id",
      role: "super_admin_lector",
      clientIp: "192.0.2.4",
      rootDomain: "example.test",
      secure: true,
      ...overrides,
      createInvitation: async (...args) => {
        calls.push(["create", ...args]);
        return createInvitation(...args);
      },
      sendEmail: async (...args) => {
        calls.push(["send", ...args]);
        return sendEmail(...args);
      },
      enqueueAlerts: async (...args) => {
        calls.push(["enqueue", ...args]);
        return enqueueAlerts(...args);
      },
      processAlerts: async (...args) => {
        calls.push(["process", ...args]);
        return processAlerts(...args);
      },
    },
  };
}

test("rejects an invalid root domain before creating an invitation", async () => {
  const fake = dependencies({ rootDomain: "evil.test/path" });

  assert.deepEqual(await runAdminInvitationFlow(fake.input), {
    ok: false,
    reason: "invalid_root_domain",
  });
  assert.deepEqual(fake.calls, []);
});

test("returns service failures without sending mail or alerting", async () => {
  for (const reason of ["invalid_email", "account_exists", "inviter_not_allowed", "quota_exceeded"]) {
    const fake = dependencies({
      createInvitation: async () => ({ ok: false, reason }),
    });

    assert.deepEqual(await runAdminInvitationFlow(fake.input), {
      ok: false,
      reason,
    });
    assert.deepEqual(fake.calls.map(([name]) => name), ["create"]);
  }
});

test("sends a role-specific link and enqueues alerts without returning its URL or token", async () => {
  const fake = dependencies();

  const result = await runAdminInvitationFlow(fake.input);

  assert.deepEqual(result, {
    ok: true,
    emailSent: true,
    invitationId: "invitation-id",
    sendError: null,
  });
  assert.deepEqual(fake.calls.map(([name]) => name), [
    "create",
    "send",
    "enqueue",
    "process",
  ]);
  assert.deepEqual(fake.calls[0], [
    "create",
    "reader@example.test",
    "admin-id",
    "super_admin_lector",
    "192.0.2.4",
  ]);
  assert.equal(fake.calls[1][1], "reader@example.test");
  assert.match(fake.calls[1][2], /^https:\/\/sup-admin\.example\.test\//);
  assert.equal(fake.calls[1][3], CREATED.expiresAt);
  assert.equal(fake.calls[1][4], "super_admin_lector");
  assert.deepEqual(fake.calls[2], ["enqueue", "audit-id"]);
  assert.equal(JSON.stringify(result).includes(CREATED.token), false);
  assert.equal(JSON.stringify(result).includes("invitationUrl"), false);
});

test("keeps the invitation when link delivery fails", async () => {
  const fake = dependencies({
    sendEmail: async () => {
      throw new Error("transport failure");
    },
  });

  const result = await runAdminInvitationFlow(fake.input);
  assert.deepEqual(result, {
    ok: true,
    emailSent: false,
    invitationId: "invitation-id",
    sendError: "email_failed",
  });
  assert.deepEqual(fake.calls.map(([name]) => name), [
    "create",
    "send",
    "enqueue",
    "process",
  ]);
});

test("alert enqueue and processing failures never block invitation creation", async () => {
  const fake = dependencies({
    enqueueAlerts: async () => {
      throw new Error("outbox unavailable");
    },
  });

  const result = await runAdminInvitationFlow(fake.input);
  assert.equal(result.ok, true);
  assert.equal(fake.calls[0][0], "create");
  assert.deepEqual(fake.calls.map(([name]) => name), ["create", "send", "enqueue"]);
});

test("alert processing failure after enqueue never blocks invitation creation", async () => {
  const fake = dependencies({
    processAlerts: async () => {
      throw new Error("alert delivery failed");
    },
  });

  const result = await runAdminInvitationFlow(fake.input);
  assert.equal(result.ok, true);
  assert.deepEqual(fake.calls.map(([name]) => name), [
    "create",
    "send",
    "enqueue",
    "process",
  ]);
});

