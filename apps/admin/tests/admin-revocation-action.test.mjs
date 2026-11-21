import assert from "node:assert/strict";
import test from "node:test";
import { runAdminRevocationAction } from "../src/lib/admin-revocation-action.mjs";

const VALID_TARGET_ID = "11111111-2222-4333-8444-555555555555";
const VALID_ACTOR = { id: "00000000-0000-4000-8000-000000000000", role: "super_admin" };

test("runAdminRevocationAction: rejects invalid UUID targetId with reason target_not_found", async () => {
  const invalidTargetIds = ["", "not-a-uuid", "12345", "11111111-2222-4333-8444", null, undefined, 123];

  for (const targetId of invalidTargetIds) {
    const result = await runAdminRevocationAction({
      actor: VALID_ACTOR,
      targetId,
      password: "valid-password",
      revokeAccount: async () => {
        throw new Error("should not be called");
      },
    });

    assert.deepEqual(result, { ok: false, reason: "target_not_found" });
  }
});

test("runAdminRevocationAction: rejects invalid password with reason invalid_password", async () => {
  const invalidPasswords = ["", null, undefined, 12345, "a".repeat(257)];

  for (const password of invalidPasswords) {
    const result = await runAdminRevocationAction({
      actor: VALID_ACTOR,
      targetId: VALID_TARGET_ID,
      password,
      revokeAccount: async () => {
        throw new Error("should not be called");
      },
    });

    assert.deepEqual(result, { ok: false, reason: "invalid_password" });
  }
});

test("runAdminRevocationAction: rejects missing or invalid actor with reason not_allowed", async () => {
  const invalidActors = [null, undefined, {}, { id: "" }, { id: 123 }];

  for (const actor of invalidActors) {
    const result = await runAdminRevocationAction({
      actor,
      targetId: VALID_TARGET_ID,
      password: "valid-password",
      revokeAccount: async () => {
        throw new Error("should not be called");
      },
    });

    assert.deepEqual(result, { ok: false, reason: "not_allowed" });
  }
});

test("runAdminRevocationAction: calls revokeAccount with correct parameters and returns success", async () => {
  let calledWith = null;
  let enqueuedAuditId = null;
  let processAlertsCalled = false;

  const result = await runAdminRevocationAction({
    actor: VALID_ACTOR,
    targetId: VALID_TARGET_ID,
    password: "secret-password",
    revokeAccount: async (input) => {
      calledWith = input;
      return { ok: true, auditId: "audit-123" };
    },
    enqueueAlerts: async (auditId) => {
      enqueuedAuditId = auditId;
    },
    processAlerts: async () => {
      processAlertsCalled = true;
    },
  });

  assert.deepEqual(calledWith, {
    actorId: VALID_ACTOR.id,
    targetId: VALID_TARGET_ID,
    password: "secret-password",
  });
  assert.equal(enqueuedAuditId, "audit-123");
  assert.equal(processAlertsCalled, true);
  assert.deepEqual(result, { ok: true, reason: "success" });
});

test("runAdminRevocationAction: forwards error reasons from revokeAccount without enqueueing alerts", async () => {
  const failureReasons = [
    "not_allowed",
    "no_password",
    "invalid_password",
    "rate_limited",
    "target_not_found",
    "target_already_revoked",
    "target_not_allowed",
    "self_revocation",
    "insufficient_permissions",
  ];

  for (const reason of failureReasons) {
    let alertCalled = false;
    const result = await runAdminRevocationAction({
      actor: VALID_ACTOR,
      targetId: VALID_TARGET_ID,
      password: "secret-password",
      revokeAccount: async () => ({ ok: false, reason }),
      enqueueAlerts: async () => {
        alertCalled = true;
      },
    });

    assert.deepEqual(result, { ok: false, reason });
    assert.equal(alertCalled, false);
  }
});

test("runAdminRevocationAction: swallows enqueueAlerts error and still succeeds", async () => {
  const result = await runAdminRevocationAction({
    actor: VALID_ACTOR,
    targetId: VALID_TARGET_ID,
    password: "secret-password",
    revokeAccount: async () => ({ ok: true, auditId: "audit-456" }),
    enqueueAlerts: async () => {
      throw new Error("DB network failure during alert enqueue");
    },
    processAlerts: async () => {},
  });

  assert.deepEqual(result, { ok: true, reason: "success" });
});

test("runAdminRevocationAction: swallows processAlerts error and still succeeds", async () => {
  const result = await runAdminRevocationAction({
    actor: VALID_ACTOR,
    targetId: VALID_TARGET_ID,
    password: "secret-password",
    revokeAccount: async () => ({ ok: true, auditId: "audit-789" }),
    enqueueAlerts: async () => {},
    processAlerts: async () => {
      throw new Error("SMTP failure during outbox processing");
    },
  });

  assert.deepEqual(result, { ok: true, reason: "success" });
});

test("runAdminRevocationAction: does not return password in the result", async () => {
  const result = await runAdminRevocationAction({
    actor: VALID_ACTOR,
    targetId: VALID_TARGET_ID,
    password: "secret-password",
    revokeAccount: async () => ({ ok: true, auditId: "audit-000" }),
  });

  assert.equal(Object.prototype.hasOwnProperty.call(result, "password"), false);
});
