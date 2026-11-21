import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTH_ADMIN_GOOGLE_START_ERROR_MESSAGE,
  runStartAdminGoogleSignIn,
} from "../src/lib/auth-admin-google-start.mjs";

const CENTRAL_HOST = "auth-admin.localhost:3001";

test("admin Google start creates a ticket only for a university host and returns a POST target with kind university", async () => {
  let createdFor;
  const result = await runStartAdminGoogleSignIn({
    getHostContext: async () => ({
      kind: "university",
      universityId: "university-test",
    }),
    createTicket: async (universityId, surface) => {
      createdFor = universityId;
      assert.equal(surface, "admin");
      return "ticket-secret";
    },
    getCentralHost: () => CENTRAL_HOST,
    secure: false,
  });

  assert.equal(createdFor, "university-test");
  assert.deepEqual(result, {
    ok: true,
    action: `http://${CENTRAL_HOST}/auth-admin/start`,
    ticket: "ticket-secret",
    kind: "university",
  });
  assert.equal(result.action.includes(result.ticket), false);
});

test("admin Google start succeeds on super host with kind super_login", async () => {
  let superTicketCreated = false;
  const result = await runStartAdminGoogleSignIn({
    getHostContext: async () => ({ kind: "super" }),
    createTicket: async () => {
      throw new Error("unexpected call to createTicket");
    },
    createSuperLoginTicket: async () => {
      superTicketCreated = true;
      return "super-ticket-xyz";
    },
    getCentralHost: () => CENTRAL_HOST,
    secure: false,
  });

  assert.equal(superTicketCreated, true);
  assert.deepEqual(result, {
    ok: true,
    action: `http://${CENTRAL_HOST}/auth-admin/start`,
    ticket: "super-ticket-xyz",
    kind: "super_login",
  });
});

test("admin Google start rejects unresolved and null hosts without creating tickets", async () => {
  for (const hostContext of [
    null,
    { kind: "unknown" },
  ]) {
    let ticketCreated = false;
    let superTicketCreated = false;
    const result = await runStartAdminGoogleSignIn({
      getHostContext: async () => hostContext,
      createTicket: async () => {
        ticketCreated = true;
        return "ticket";
      },
      createSuperLoginTicket: async () => {
        superTicketCreated = true;
        return "super-ticket";
      },
      getCentralHost: () => CENTRAL_HOST,
      secure: false,
    });
    assert.deepEqual(result, {
      ok: false,
      message: AUTH_ADMIN_GOOGLE_START_ERROR_MESSAGE,
    });
    assert.equal(ticketCreated, false);
    assert.equal(superTicketCreated, false);
  }
});

test("admin Google start hides host and ticket failures behind one generic result", async () => {
  const result = await runStartAdminGoogleSignIn({
    getHostContext: async () => {
      throw new Error("internal database detail");
    },
    createTicket: async () => "unused",
    getCentralHost: () => CENTRAL_HOST,
    secure: false,
  });

  assert.deepEqual(result, {
    ok: false,
    message: AUTH_ADMIN_GOOGLE_START_ERROR_MESSAGE,
  });
});

test("admin Google start hides super ticket failure behind one generic result", async () => {
  for (const failTicket of [
    async () => { throw new Error("super ticket failure"); },
    async () => null,
    async () => "",
  ]) {
    const result = await runStartAdminGoogleSignIn({
      getHostContext: async () => ({ kind: "super" }),
      createSuperLoginTicket: failTicket,
      getCentralHost: () => CENTRAL_HOST,
      secure: false,
    });

    assert.deepEqual(result, {
      ok: false,
      message: AUTH_ADMIN_GOOGLE_START_ERROR_MESSAGE,
    });
  }
});
