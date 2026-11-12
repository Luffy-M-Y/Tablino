import assert from "node:assert/strict";
import test from "node:test";
import { getAuthCentralStartUrl } from "../src/lib/auth-central-start-url.mjs";
import { runStartGoogleSignIn } from "../src/lib/google-sign-in-start.mjs";

// ─── getAuthCentralStartUrl ───────────────────────────────────────────────────

test("getAuthCentralStartUrl builds an http URL for localhost in dev", () => {
  assert.equal(
    getAuthCentralStartUrl("localhost:3000", { secure: false }),
    "http://localhost:3000/auth-central/start",
  );
});

test("getAuthCentralStartUrl builds an https URL in production", () => {
  assert.equal(
    getAuthCentralStartUrl("auth.tablino.com", { secure: true }),
    "https://auth.tablino.com/auth-central/start",
  );
});

test("getAuthCentralStartUrl returns null for an invalid host", () => {
  assert.equal(getAuthCentralStartUrl("https://auth.tablino.com", { secure: true }), null);
  assert.equal(getAuthCentralStartUrl("auth.tablino.com/path", { secure: false }), null);
});

test("getAuthCentralStartUrl returns null for an absent host", () => {
  assert.equal(getAuthCentralStartUrl(undefined, { secure: false }), null);
});

// ─── runStartGoogleSignIn ─────────────────────────────────────────────────────

test("runStartGoogleSignIn returns the action URL and ticket for the host university", async () => {
  const result = await runStartGoogleSignIn({
    getUniversityId: async () => "university-test",
    createTicket: async (universityId) => {
      assert.equal(universityId, "university-test");
      return "ticket-abc";
    },
    getCentralHost: () => "localhost:3000",
    secure: false,
  });

  assert.deepEqual(result, {
    ok: true,
    action: "http://localhost:3000/auth-central/start",
    ticket: "ticket-abc",
  });
});

test("runStartGoogleSignIn returns a generic error without creating a ticket when the central host is invalid", async () => {
  let ticketCreated = false;
  const result = await runStartGoogleSignIn({
    getUniversityId: async () => "university-test",
    createTicket: async () => { ticketCreated = true; return "ticket"; },
    getCentralHost: () => undefined,
    secure: false,
  });

  assert.equal(result.ok, false);
  assert.equal(ticketCreated, false);
  if (!result.ok) assert.equal(result.message, "Impossible de démarrer la connexion. Réessayez.");
});

test("runStartGoogleSignIn never calls getUniversityId when the central host is invalid", async () => {
  let universityCalled = false;
  await runStartGoogleSignIn({
    getUniversityId: async () => { universityCalled = true; return "university-test"; },
    createTicket: async () => "ticket",
    getCentralHost: () => undefined,
    secure: false,
  });

  assert.equal(universityCalled, false);
});

test("runStartGoogleSignIn returns a generic error on ticket creation failure", async () => {
  const result = await runStartGoogleSignIn({
    getUniversityId: async () => "university-test",
    createTicket: async () => { throw new Error("DB error"); },
    getCentralHost: () => "localhost:3000",
    secure: false,
  });

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.message, "Impossible de démarrer la connexion. Réessayez.");
});

test("runStartGoogleSignIn never calls createTicket when getUniversityId throws", async () => {
  let ticketCalled = false;
  const result = await runStartGoogleSignIn({
    getUniversityId: async () => { throw new Error("UNIVERSITY_ID missing"); },
    createTicket: async () => { ticketCalled = true; return "ticket"; },
    getCentralHost: () => "localhost:3000",
    secure: false,
  });

  assert.equal(result.ok, false);
  assert.equal(ticketCalled, false);
});

test("runStartGoogleSignIn error message does not contain the original error text", async () => {
  const result = await runStartGoogleSignIn({
    getUniversityId: async () => { throw new Error("secret-internal-detail"); },
    createTicket: async () => "ticket",
    getCentralHost: () => "localhost:3000",
    secure: false,
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.message.includes("secret-internal-detail"), false);
    assert.equal(result.message, "Impossible de démarrer la connexion. Réessayez.");
  }
});
