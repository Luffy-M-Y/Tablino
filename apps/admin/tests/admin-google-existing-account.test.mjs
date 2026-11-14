import assert from "node:assert/strict";
import test from "node:test";
import { getAdminGoogleExistingAccountEmail } from "../src/lib/admin-google-existing-account.mjs";

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
