import assert from "node:assert/strict";
import test from "node:test";
import {
  ADMIN_INVITATION_GOOGLE_START_ERROR_MESSAGE,
  runStartAdminInvitationGoogle,
} from "../src/lib/admin-invitation-google-start.mjs";
import { runAdminInvitationAcceptance } from "../src/lib/admin-invitation.mjs";

const CENTRAL_HOST = "auth-admin.localhost:3001";

test("hôte non super refusé: rejette sans créer de ticket pour les hôtes université, central ou inconnus", async () => {
  for (const hostContext of [
    { kind: "university", universityId: "univ-1" },
    { kind: "central" },
    null,
  ]) {
    let ticketCreated = false;
    const result = await runStartAdminInvitationGoogle({
      getHostContext: async () => hostContext,
      getToken: async () => "valid-invitation-token",
      createTicket: async () => {
        ticketCreated = true;
        return "ticket";
      },
      getCentralHost: () => CENTRAL_HOST,
      secure: false,
    });
    assert.deepEqual(result, {
      ok: false,
      message: ADMIN_INVITATION_GOOGLE_START_ERROR_MESSAGE,
    });
    assert.equal(ticketCreated, false);
  }
});

test("jeton absent ou invalide refusé: rejette sans créer de ticket", async () => {
  for (const token of [
    undefined,
    null,
    "",
    123,
    {},
  ]) {
    let ticketCreated = false;
    const result = await runStartAdminInvitationGoogle({
      getHostContext: async () => ({ kind: "super" }),
      getToken: async () => token,
      createTicket: async () => {
        ticketCreated = true;
        return "ticket";
      },
      getCentralHost: () => CENTRAL_HOST,
      secure: false,
    });
    assert.deepEqual(result, {
      ok: false,
      message: ADMIN_INVITATION_GOOGLE_START_ERROR_MESSAGE,
    });
    assert.equal(ticketCreated, false);
  }
});

test("ticket null refusé: renvoie l'erreur générique d'indisponibilité lorsque createTicket renvoie null", async () => {
  let ticketCalledWith = null;
  const result = await runStartAdminInvitationGoogle({
    getHostContext: async () => ({ kind: "super" }),
    getToken: async () => "valid-invitation-token",
    createTicket: async (tok) => {
      ticketCalledWith = tok;
      return null;
    },
    getCentralHost: () => CENTRAL_HOST,
    secure: false,
  });

  assert.equal(ticketCalledWith, "valid-invitation-token");
  assert.deepEqual(result, {
    ok: false,
    message: ADMIN_INVITATION_GOOGLE_START_ERROR_MESSAGE,
  });
});

test("succès renvoie le ticket et la cible de start avec kind=invitation", async () => {
  let ticketCalledWith = null;
  const result = await runStartAdminInvitationGoogle({
    getHostContext: async () => ({ kind: "super" }),
    getToken: async () => "secret-invitation-token-xyz",
    createTicket: async (tok) => {
      ticketCalledWith = tok;
      return "start-ticket-abc";
    },
    getCentralHost: () => CENTRAL_HOST,
    secure: false,
  });

  assert.equal(ticketCalledWith, "secret-invitation-token-xyz");
  assert.deepEqual(result, {
    ok: true,
    action: `http://${CENTRAL_HOST}/auth-admin/start`,
    ticket: "start-ticket-abc",
    kind: "invitation",
  });
  assert.equal(result.action.includes("secret-invitation-token-xyz"), false);
  assert.equal(result.ticket.includes("secret-invitation-token-xyz"), false);
});

test("non-régression des actions mot de passe + OTP: start, verify et resend restent fonctionnels", async () => {
  const calls = [];
  const checkRateLimit = async () => ({ allowed: true });
  const recordFailure = async () => {};
  const startAcceptance = async (token, password, confirmation) => {
    calls.push(["start", token, password, confirmation]);
    return { ok: true, email: "invited@example.test", code: "123456" };
  };
  const resendCode = async (token) => {
    calls.push(["resend", token]);
    return { ok: true, email: "invited@example.test", code: "654321" };
  };
  const consumeCode = async (token, code) => {
    calls.push(["consume", token, code]);
    return { ok: true, role: "super_admin_lector" };
  };

  const baseInput = {
    token: "token-test",
    password: "Password123!",
    passwordConfirmation: "Password123!",
    code: "123456",
    clientIp: "127.0.0.1",
    isProduction: false,
    checkRateLimit,
    recordFailure,
    startAcceptance,
    resendCode,
    consumeCode,
  };

  const startResult = await runAdminInvitationAcceptance({
    ...baseInput,
    stage: "start",
  });
  assert.deepEqual(startResult, {
    reason: "code_sent",
    clearCookie: false,
    step: "code",
    email: "invited@example.test",
    code: "123456",
  });

  const resendResult = await runAdminInvitationAcceptance({
    ...baseInput,
    stage: "resend",
  });
  assert.deepEqual(resendResult, {
    reason: "code_resent",
    clearCookie: false,
    step: "code",
    email: "invited@example.test",
    code: "654321",
  });

  const verifyResult = await runAdminInvitationAcceptance({
    ...baseInput,
    stage: "verify",
  });
  assert.deepEqual(verifyResult, {
    reason: "accepted",
    clearCookie: true,
    step: "code",
    role: "super_admin_lector",
  });

  assert.deepEqual(calls, [
    ["start", "token-test", "Password123!", "Password123!"],
    ["resend", "token-test"],
    ["consume", "token-test", "123456"],
  ]);
});
