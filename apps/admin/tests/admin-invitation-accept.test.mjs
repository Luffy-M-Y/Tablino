import assert from "node:assert/strict";
import test from "node:test";
import { runAdminInvitationAcceptance } from "../src/lib/admin-invitation.mjs";

const VALID = {
  token: "invitation-token",
  password: "A-strong-password",
  passwordConfirmation: "A-strong-password",
  clientIp: "192.0.2.1",
  isProduction: true,
};

function dependencies(overrides = {}) {
  const calls = [];
  const checkRateLimit = overrides.checkRateLimit ?? (async () => ({ allowed: true }));
  const recordFailure = overrides.recordFailure ?? (async () => {});
  const consumeInvitation = overrides.consumeInvitation ?? (async () => ({
    ok: true,
    role: "super_admin_lector",
  }));
  return {
    calls,
    input: {
      ...VALID,
      ...overrides,
      checkRateLimit: async (...args) => {
        calls.push(["limit", ...args]);
        return checkRateLimit(...args);
      },
      recordFailure: async (...args) => {
        calls.push(["failure", ...args]);
        return recordFailure(...args);
      },
      consumeInvitation: async (...args) => {
        calls.push(["consume", ...args]);
        return consumeInvitation(...args);
      },
    },
  };
}

test("validation errors do not consume or clear the invitation", async () => {
  const fake = dependencies({ passwordConfirmation: "different" });

  assert.deepEqual(await runAdminInvitationAcceptance(fake.input), {
    reason: "password_mismatch",
    clearCookie: false,
  });
  assert.deepEqual(fake.calls.map(([name]) => name), ["limit"]);
});

test("production refuses a missing client IP without reaching rate-limit storage", async () => {
  const fake = dependencies({ clientIp: null });

  assert.deepEqual(await runAdminInvitationAcceptance(fake.input), {
    reason: "ip_unavailable",
    clearCookie: false,
  });
  assert.deepEqual(fake.calls, []);
});

test("an IP rate-limit block leaves the cookie and invitation untouched", async () => {
  const fake = dependencies({
    checkRateLimit: async () => ({ allowed: false }),
  });

  assert.deepEqual(await runAdminInvitationAcceptance(fake.input), {
    reason: "rate_limited",
    clearCookie: false,
  });
  assert.deepEqual(fake.calls.map(([name]) => name), ["limit"]);
});

test("a service invalid-password result does not record an IP failure or clear the cookie", async () => {
  const fake = dependencies({
    consumeInvitation: async () => ({ ok: false, reason: "invalid_password" }),
  });

  assert.deepEqual(await runAdminInvitationAcceptance(fake.input), {
    reason: "invalid_password",
    clearCookie: false,
  });
  assert.deepEqual(fake.calls.map(([name]) => name), ["limit", "consume"]);
});

test("an unavailable invitation records the IP failure and clears the cookie", async () => {
  const fake = dependencies({
    consumeInvitation: async () => ({
      ok: false,
      reason: "invitation_unavailable",
    }),
  });

  assert.deepEqual(await runAdminInvitationAcceptance(fake.input), {
    reason: "invitation_unavailable",
    clearCookie: true,
  });
  assert.deepEqual(fake.calls.map(([name]) => name), ["limit", "consume", "failure"]);
  assert.deepEqual(fake.calls[2], ["failure", "login_ip", VALID.clientIp]);
});

test("only successful or unavailable consumption results clear the cookie", async () => {
  const success = dependencies();
  const unavailable = dependencies({
    consumeInvitation: async () => ({
      ok: false,
      reason: "invitation_unavailable",
    }),
  });

  assert.equal(
    (await runAdminInvitationAcceptance(success.input)).clearCookie,
    true,
  );
  assert.deepEqual(await runAdminInvitationAcceptance(unavailable.input), {
    reason: "invitation_unavailable",
    clearCookie: true,
  });
});
