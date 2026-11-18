import assert from "node:assert/strict";
import test from "node:test";
import { runAdminInvitationAcceptance } from "../src/lib/admin-invitation.mjs";

const VALID = {
  token: "invitation-token",
  password: "A-strong-password",
  passwordConfirmation: "A-strong-password",
  code: "123456",
  clientIp: "192.0.2.1",
  isProduction: true,
};

function dependencies(overrides = {}) {
  const calls = [];
  const checkRateLimit = overrides.checkRateLimit ?? (async () => ({ allowed: true }));
  const recordFailure = overrides.recordFailure ?? (async () => {});
  const startAcceptance = overrides.startAcceptance ?? (async () => ({
    ok: true,
    email: "reader@example.test",
    code: "123456",
  }));
  const resendCode = overrides.resendCode ?? (async () => ({
    ok: true,
    email: "reader@example.test",
    code: "654321",
  }));
  const consumeCode = overrides.consumeCode ?? (async () => ({
    ok: true,
    role: "super_admin_lector",
  }));
  return {
    calls,
    input: {
      ...VALID,
      stage: "verify",
      ...overrides,
      checkRateLimit: async (...args) => {
        calls.push(["limit", ...args]);
        return checkRateLimit(...args);
      },
      recordFailure: async (...args) => {
        calls.push(["failure", ...args]);
        return recordFailure(...args);
      },
      startAcceptance: async (...args) => {
        calls.push(["start", ...args]);
        return startAcceptance(...args);
      },
      resendCode: async (...args) => {
        calls.push(["resend", ...args]);
        return resendCode(...args);
      },
      consumeCode: async (...args) => {
        calls.push(["consume", ...args]);
        return consumeCode(...args);
      },
    },
  };
}

test("production refuses a missing client IP before rate-limit storage", async () => {
  const fake = dependencies({ clientIp: null, stage: "verify" });

  assert.deepEqual(await runAdminInvitationAcceptance(fake.input), {
    reason: "ip_unavailable",
    clearCookie: false,
    step: "code",
  });
  assert.deepEqual(fake.calls, []);
});

test("unknown acceptance stages fail closed without consuming a code", async () => {
  const fake = dependencies({ stage: "unexpected" });

  assert.deepEqual(await runAdminInvitationAcceptance(fake.input), {
    reason: "invitation_unavailable",
    clearCookie: false,
    step: "password",
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
    step: "code",
  });
  assert.deepEqual(fake.calls.map(([name]) => name), ["limit"]);
});

test("a mismatched password prevents OTP creation", async () => {
  const fake = dependencies({
    stage: "start",
    passwordConfirmation: "different",
    startAcceptance: async (token, password, passwordConfirmation) => (
      password !== passwordConfirmation
        ? { ok: false, reason: "password_mismatch" }
        : { ok: true, email: "reader@example.test", code: "123456" }
    ),
  });

  assert.deepEqual(await runAdminInvitationAcceptance(fake.input), {
    reason: "password_mismatch",
    clearCookie: false,
    step: "password",
  });
  assert.deepEqual(fake.calls.map(([name]) => name), ["limit", "start"]);
});

test("matching passwords reach OTP creation", async () => {
  const receivedArguments = [];
  const passwordConfirmation = VALID.password;
  const fake = dependencies({
    stage: "start",
    passwordConfirmation,
    startAcceptance: async (token, password, confirmation) => {
      receivedArguments.push([token, password, confirmation]);
      return password !== confirmation
        ? { ok: false, reason: "password_mismatch" }
        : { ok: true, email: "reader@example.test", code: "123456" };
    },
  });

  assert.deepEqual(await runAdminInvitationAcceptance(fake.input), {
    reason: "code_sent",
    clearCookie: false,
    step: "code",
    email: "reader@example.test",
    code: "123456",
  });
  assert.deepEqual(fake.calls.map(([name]) => name), ["limit", "start"]);
  assert.deepEqual(receivedArguments, [[
    VALID.token,
    VALID.password,
    passwordConfirmation,
  ]]);
});

test("a repeated start directs the user back to an existing code during its cooldown", async () => {
  const fake = dependencies({
    stage: "start",
    startAcceptance: async () => ({ ok: false, reason: "too_soon" }),
  });

  assert.deepEqual(await runAdminInvitationAcceptance(fake.input), {
    reason: "too_soon",
    clearCookie: false,
    step: "code",
  });
});

test("an invalid password does not record an IP failure or clear the cookie", async () => {
  const fake = dependencies({
    stage: "start",
    startAcceptance: async () => ({ ok: false, reason: "invalid_password" }),
  });

  assert.deepEqual(await runAdminInvitationAcceptance(fake.input), {
    reason: "invalid_password",
    clearCookie: false,
    step: "password",
  });
  assert.deepEqual(fake.calls.map(([name]) => name), ["limit", "start"]);
});

test("only unavailable invitations record an IP failure", async () => {
  const fake = dependencies({
    stage: "verify",
    consumeCode: async () => ({
      ok: false,
      reason: "invitation_unavailable",
    }),
  });

  assert.deepEqual(await runAdminInvitationAcceptance(fake.input), {
    reason: "invitation_unavailable",
    clearCookie: true,
    step: "code",
    role: undefined,
  });
  assert.deepEqual(fake.calls.map(([name]) => name), ["limit", "consume", "failure"]);
  assert.deepEqual(fake.calls[2], ["failure", "login_ip", VALID.clientIp]);
});

test("an unavailable invitation with no client IP does not record an IP failure", async () => {
  const fake = dependencies({
    clientIp: null,
    isProduction: false,
    consumeCode: async () => ({
      ok: false,
      reason: "invitation_unavailable",
    }),
  });

  const result = await runAdminInvitationAcceptance(fake.input);
  assert.equal(result.reason, "invitation_unavailable");
  assert.equal(fake.calls.some(([name]) => name === "failure"), false);
});

test("an incorrect OTP does not record an IP failure or clear the cookie", async () => {
  const fake = dependencies({
    stage: "verify",
    consumeCode: async () => ({ ok: false, reason: "invalid_code" }),
  });

  assert.deepEqual(await runAdminInvitationAcceptance(fake.input), {
    reason: "invalid_code",
    clearCookie: false,
    step: "code",
    role: undefined,
  });
  assert.deepEqual(fake.calls.map(([name]) => name), ["limit", "consume"]);
});

test("successful OTP acceptance uses the invitation's stored role", async () => {
  const fake = dependencies({
    stage: "verify",
    consumeCode: async () => ({ ok: true, role: "super_admin_editor" }),
  });

  assert.deepEqual(await runAdminInvitationAcceptance(fake.input), {
    reason: "accepted",
    clearCookie: true,
    step: "code",
    role: "super_admin_editor",
  });
});

test("start and resend return the destination and generated code for delivery", async () => {
  const start = dependencies({ stage: "start" });
  const resend = dependencies({ stage: "resend" });

  assert.deepEqual(await runAdminInvitationAcceptance(start.input), {
    reason: "code_sent",
    clearCookie: false,
    step: "code",
    email: "reader@example.test",
    code: "123456",
  });
  assert.deepEqual(await runAdminInvitationAcceptance(resend.input), {
    reason: "code_resent",
    clearCookie: false,
    step: "code",
    email: "reader@example.test",
    code: "654321",
  });
});
