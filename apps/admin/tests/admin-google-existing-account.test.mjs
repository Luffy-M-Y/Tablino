import assert from "node:assert/strict";
import test from "node:test";
import {
  getAdminGoogleExistingAccountEmail,
  getAdminGoogleExistingAccountMessage,
} from "../src/lib/admin-google-existing-account.mjs";

const HOST_CONTEXT = { kind: "university", universityId: "university-a" };
const TOKEN = "encrypted-admin-google-existing";

test("login prefill accepts a valid token for the current university host", () => {
  assert.equal(
    getAdminGoogleExistingAccountEmail({
      token: TOKEN,
      hostContext: HOST_CONTEXT,
      verifyToken: () => ({ email: "admin@example.test", universityId: "university-a" }),
    }),
    "admin@example.test",
  );
});

test("login prefill ignores expired, malformed, or cross-university tokens", () => {
  assert.equal(
    getAdminGoogleExistingAccountEmail({
      token: TOKEN,
      hostContext: HOST_CONTEXT,
      verifyToken: () => null,
    }),
    null,
  );
  assert.equal(
    getAdminGoogleExistingAccountEmail({
      token: TOKEN,
      hostContext: HOST_CONTEXT,
      verifyToken: () => ({ email: "admin@example.test", universityId: "university-b" }),
    }),
    null,
  );
  assert.equal(
    getAdminGoogleExistingAccountEmail({
      token: TOKEN,
      hostContext: { kind: "super" },
      verifyToken: () => ({ email: "admin@example.test", universityId: "university-a" }),
    }),
    null,
  );
  assert.equal(
    getAdminGoogleExistingAccountEmail({
      token: TOKEN,
      hostContext: null,
      verifyToken: () => ({ email: "admin@example.test", universityId: "university-a" }),
    }),
    null,
  );
});

test("login prefill accepts a valid super token for super host", () => {
  assert.equal(
    getAdminGoogleExistingAccountEmail({
      token: "super-token-valid",
      hostContext: { kind: "super" },
      verifyToken: () => null,
      verifySuperToken: (t) => (t === "super-token-valid" ? { email: "super@example.test" } : null),
    }),
    "super@example.test",
  );
});

test("login prefill rejects invalid, expired, or empty email super tokens on super host", () => {
  assert.equal(
    getAdminGoogleExistingAccountEmail({
      token: "super-token-invalid",
      hostContext: { kind: "super" },
      verifySuperToken: () => null,
    }),
    null,
  );
  assert.equal(
    getAdminGoogleExistingAccountEmail({
      token: "super-token-no-email",
      hostContext: { kind: "super" },
      verifySuperToken: () => ({ email: "" }),
    }),
    null,
  );
  assert.equal(
    getAdminGoogleExistingAccountEmail({
      token: "super-token-expired",
      hostContext: { kind: "super" },
      verifySuperToken: () => {
        throw new Error("expired");
      },
    }),
    null,
  );
  assert.equal(
    getAdminGoogleExistingAccountEmail({
      token: "super-token-missing-fn",
      hostContext: { kind: "super" },
    }),
    null,
  );
});

test("super token is rejected on university host", () => {
  let superVerifyCalled = false;
  assert.equal(
    getAdminGoogleExistingAccountEmail({
      token: "super-token",
      hostContext: HOST_CONTEXT,
      verifyToken: () => null,
      verifySuperToken: () => {
        superVerifyCalled = true;
        return { email: "super@example.test" };
      },
    }),
    null,
  );
  assert.equal(superVerifyCalled, false);
});

test("university token is rejected on super host", () => {
  let univVerifyCalled = false;
  assert.equal(
    getAdminGoogleExistingAccountEmail({
      token: TOKEN,
      hostContext: { kind: "super" },
      verifyToken: () => {
        univVerifyCalled = true;
        return { email: "admin@example.test", universityId: "university-a" };
      },
      verifySuperToken: () => null,
    }),
    null,
  );
  assert.equal(univVerifyCalled, false);
});

test("existing Google account message matches the exact admin wording", () => {
  assert.equal(
    getAdminGoogleExistingAccountMessage("admin@example.test"),
    "Un compte existe déjà avec l’adresse admin@example.test. Entrez votre mot de passe pour vous connecter.",
  );
});

test("no existing Google account message is returned when the token is not validated", () => {
  const email = getAdminGoogleExistingAccountEmail({
    token: TOKEN,
    hostContext: HOST_CONTEXT,
    verifyToken: () => null,
  });

  assert.equal(email, null);
  assert.equal(getAdminGoogleExistingAccountMessage(email), null);
});
