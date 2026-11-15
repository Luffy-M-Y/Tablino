import assert from "node:assert/strict";
import test from "node:test";
import { runSuperAdminEditorInvitationFlow } from "../src/lib/super-admin-editor-invitation.mjs";

const CREATED = {
  ok: true,
  invitationId: "invitation-id",
  email: "editor@example.test",
  token: Buffer.alloc(32, 5).toString("base64url"),
  expiresAt: new Date("2026-11-16T12:00:00.000Z"),
};

function dependencies(overrides = {}) {
  const calls = [];
  const createInvitation = overrides.createInvitation ?? (async () => CREATED);
  const sendEmail = overrides.sendEmail ?? (async () => {});
  const revokeInvitation = overrides.revokeInvitation ?? (async () => true);
  return {
    calls,
    input: {
      email: "editor@example.test",
      invitedByUserId: "admin-id",
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
      revokeInvitation: async (...args) => {
        calls.push(["revoke", ...args]);
        return revokeInvitation(...args);
      },
    },
  };
}

test("rejects an invalid root domain before creating an invitation", async () => {
  const fake = dependencies({ rootDomain: "evil.test/path" });

  assert.deepEqual(await runSuperAdminEditorInvitationFlow(fake.input), {
    ok: false,
    reason: "invalid_root_domain",
  });
  assert.deepEqual(fake.calls, []);
});

test("returns invalid email without sending mail", async () => {
  const fake = dependencies({
    createInvitation: async () => ({ ok: false, reason: "invalid_email" }),
  });

  assert.deepEqual(await runSuperAdminEditorInvitationFlow(fake.input), {
    ok: false,
    reason: "invalid_email",
  });
  assert.equal(fake.calls.length, 1);
});

test("returns account-exists without sending mail", async () => {
  const fake = dependencies({
    createInvitation: async () => ({ ok: false, reason: "account_exists" }),
  });

  assert.deepEqual(await runSuperAdminEditorInvitationFlow(fake.input), {
    ok: false,
    reason: "account_exists",
  });
  assert.equal(fake.calls.length, 1);
});

test("returns inviter-not-allowed without sending mail", async () => {
  const fake = dependencies({
    createInvitation: async () => ({ ok: false, reason: "inviter_not_allowed" }),
  });

  assert.deepEqual(await runSuperAdminEditorInvitationFlow(fake.input), {
    ok: false,
    reason: "inviter_not_allowed",
  });
  assert.equal(fake.calls.length, 1);
});

test("sends a link for the created invitation without returning its URL or token", async () => {
  const fake = dependencies();

  const result = await runSuperAdminEditorInvitationFlow(fake.input);

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(fake.calls.map(([name]) => name), ["create", "send"]);
  assert.equal(fake.calls[1][1], "editor@example.test");
  assert.match(fake.calls[1][2], /^https:\/\/sup-admin\.example\.test\//);
  assert.equal(fake.calls[1][3], CREATED.expiresAt);
  assert.equal(JSON.stringify(result).includes(CREATED.token), false);
});

test("revokes immediately when delivery fails", async () => {
  const fake = dependencies({
    sendEmail: async () => {
      throw new Error("transport failure");
    },
  });

  assert.deepEqual(await runSuperAdminEditorInvitationFlow(fake.input), {
    ok: false,
    reason: "email_failed",
  });
  assert.deepEqual(fake.calls.map(([name]) => name), ["create", "send", "revoke"]);
});

test("reports when revocation throws after delivery fails", async () => {
  const fake = dependencies({
    sendEmail: async () => {
      throw new Error("transport failure");
    },
    revokeInvitation: async () => {
      throw new Error("revocation failure");
    },
  });

  assert.deepEqual(await runSuperAdminEditorInvitationFlow(fake.input), {
    ok: false,
    reason: "email_revoke_failed",
  });
  assert.deepEqual(fake.calls.map(([name]) => name), ["create", "send", "revoke"]);
});

test("reports when revocation after delivery failure cannot be confirmed", async () => {
  const fake = dependencies({
    sendEmail: async () => {
      throw new Error("transport failure");
    },
    revokeInvitation: async () => false,
  });

  assert.deepEqual(await runSuperAdminEditorInvitationFlow(fake.input), {
    ok: false,
    reason: "email_revoke_failed",
  });
});
