import assert from "node:assert/strict";
import test from "node:test";
import {
  getInvitableAdminRoles,
  runAdminInvitationAction,
} from "../src/lib/admin-invitation-action.mjs";

const CREATED = {
  ok: true,
  invitationId: "invitation-id",
  auditId: "audit-id",
  email: "reader@example.test",
  role: "super_admin_lector",
  token: Buffer.alloc(32, 4).toString("base64url"),
  expiresAt: new Date("2026-11-16T12:00:00.000Z"),
};

function dependencies(actor, overrides = {}) {
  const calls = [];
  return {
    calls,
    input: {
      actor: { id: "actor-id", role: actor },
      email: "reader@example.test",
      role: "super_admin_lector",
      password: "",
      clientIp: "192.0.2.3",
      rootDomain: "example.test",
      secure: true,
      verifyStepUp: async () => ({ ok: true }),
      createInvitation: async (...args) => {
        calls.push(["create", ...args]);
        return CREATED;
      },
      sendEmail: async (...args) => calls.push(["send", ...args]),
      enqueueAlerts: async (...args) => calls.push(["enqueue", ...args]),
      processAlerts: async () => calls.push(["process"]),
      ...overrides,
    },
  };
}

test("the permission matrix supplies invitable roles without a role fallback", () => {
  assert.deepEqual(getInvitableAdminRoles("super_admin"), [
    "super_admin_editor",
    "super_admin_lector",
  ]);
  assert.deepEqual(getInvitableAdminRoles("super_admin_editor"), [
    "super_admin_lector",
  ]);
  assert.deepEqual(getInvitableAdminRoles("super_admin_lector"), []);
  assert.deepEqual(getInvitableAdminRoles("university_admin"), []);
  assert.deepEqual(getInvitableAdminRoles("unknown"), []);
});

test("the chief can invite an editor only after successful step-up", async () => {
  let stepUpCalls = 0;
  const fake = dependencies("super_admin", {
    role: "super_admin_editor",
    password: "current-password",
    verifyStepUp: async (id, password) => {
      stepUpCalls++;
      assert.equal(id, "actor-id");
      assert.equal(password, "current-password");
      return { ok: true };
    },
  });

  const result = await runAdminInvitationAction(fake.input);
  assert.equal(result.ok, true);
  assert.equal(stepUpCalls, 1);
  assert.deepEqual(fake.calls.map(([name]) => name), [
    "create",
    "send",
    "enqueue",
    "process",
  ]);
});

test("the chief can invite a lector without step-up", async () => {
  const fake = dependencies("super_admin");

  assert.equal((await runAdminInvitationAction(fake.input)).ok, true);
  assert.deepEqual(fake.calls.map(([name]) => name), [
    "create",
    "send",
    "enqueue",
    "process",
  ]);
});

test("a missing inviter password blocks an editor invitation", async () => {
  const fake = dependencies("super_admin", {
    role: "super_admin_editor",
    verifyStepUp: async () => ({ ok: false, reason: "no_password" }),
  });

  assert.deepEqual(await runAdminInvitationAction(fake.input), {
    ok: false,
    reason: "step_up_no_password",
  });
  assert.deepEqual(fake.calls, []);
});

test("a failed step-up blocks invitation creation", async () => {
  const fake = dependencies("super_admin", {
    role: "super_admin_editor",
    verifyStepUp: async () => ({ ok: false, reason: "invalid_password" }),
  });

  assert.deepEqual(await runAdminInvitationAction(fake.input), {
    ok: false,
    reason: "step_up_invalid",
  });
  assert.deepEqual(fake.calls, []);
});

test("the editor can invite only a lector and does not need step-up", async () => {
  let stepUpCalls = 0;
  const fake = dependencies("super_admin_editor", {
    verifyStepUp: async () => {
      stepUpCalls++;
      return { ok: true };
    },
  });

  assert.equal((await runAdminInvitationAction(fake.input)).ok, true);
  assert.equal(stepUpCalls, 0);
  assert.deepEqual(fake.calls.map(([name]) => name), [
    "create",
    "send",
    "enqueue",
    "process",
  ]);
});

test("a rate-limited editor step-up returns a retry message reason", async () => {
  const fake = dependencies("super_admin", {
    role: "super_admin_editor",
    verifyStepUp: async () => ({ ok: false, reason: "rate_limited" }),
  });

  assert.deepEqual(await runAdminInvitationAction(fake.input), {
    ok: false,
    reason: "step_up_rate_limited",
  });
  assert.deepEqual(fake.calls, []);
});

test("editor, lector, and university roles cannot invite an editor or lector outside the matrix", async () => {
  for (const [actorRole, invitationRole] of [
    ["super_admin_editor", "super_admin_editor"],
    ["super_admin_lector", "super_admin_lector"],
    ["university_admin", "super_admin_lector"],
  ]) {
    const fake = dependencies(actorRole, { role: invitationRole });
    assert.deepEqual(await runAdminInvitationAction(fake.input), {
      ok: false,
      reason: "inviter_not_allowed",
    });
    assert.deepEqual(fake.calls, []);
  }
});

test("unknown invitation roles are rejected by default", async () => {
  const fake = dependencies("super_admin", { role: "student" });

  assert.deepEqual(await runAdminInvitationAction(fake.input), {
    ok: false,
    reason: "invalid_role",
  });
  assert.deepEqual(fake.calls, []);
});

test("invitation email or alert failures never roll back the invitation", async () => {
  const fake = dependencies("super_admin_editor", {
    sendEmail: async () => {
      throw new Error("email unavailable");
    },
    enqueueAlerts: async () => {
      throw new Error("outbox unavailable");
    },
  });

  const result = await runAdminInvitationAction(fake.input);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.emailSent, false);
    assert.equal(result.sendError, "email_failed");
  }
  assert.equal(fake.calls[0][0], "create");
});
