import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTH_ADMIN_GOOGLE_START_ERROR_MESSAGE,
  runStartAdminGoogleSignIn,
} from "../src/lib/auth-admin-google-start.mjs";

const CENTRAL_HOST = "auth-admin.localhost:3001";

test("admin Google start creates a ticket only for a university host and returns a POST target", async () => {
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
  });
  assert.equal(result.action.includes(result.ticket), false);
});

test("admin Google start rejects super-admin and unresolved hosts without creating tickets", async () => {
  for (const hostContext of [
    { kind: "super" },
    null,
  ]) {
    let ticketCreated = false;
    const result = await runStartAdminGoogleSignIn({
      getHostContext: async () => hostContext,
      createTicket: async () => {
        ticketCreated = true;
        return "ticket";
      },
      getCentralHost: () => CENTRAL_HOST,
      secure: false,
    });
    assert.deepEqual(result, {
      ok: false,
      message: AUTH_ADMIN_GOOGLE_START_ERROR_MESSAGE,
    });
    assert.equal(ticketCreated, false);
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
