import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTH_ADMIN_CALLBACK_URL,
  AUTH_ADMIN_SIGNIN_ACTION,
  AUTH_ADMIN_SIGNIN_ERROR,
  getAuthAdminSigninPage,
} from "../src/lib/auth-admin-signin.mjs";
import { createAuthAdminTransaction } from "../src/lib/auth-admin-transaction.mjs";

const NOW = new Date("2026-11-13T21:00:00.000Z");
const SECRET = "test-nextauth-secret";

test("admin signin page reports a generic expired-session state for invalid cookies", () => {
  assert.deepEqual(
    getAuthAdminSigninPage(undefined, { now: NOW, secret: SECRET }),
    { kind: "expired", message: AUTH_ADMIN_SIGNIN_ERROR },
  );
});

test("admin signin page provides Google form data for a valid transaction cookie", () => {
  const transaction = createAuthAdminTransaction({
    universityId: "university-test",
    now: NOW,
    secret: SECRET,
  });

  assert.deepEqual(
    getAuthAdminSigninPage(transaction, { now: NOW, secret: SECRET }),
    {
      kind: "signin",
      action: AUTH_ADMIN_SIGNIN_ACTION,
      method: "post",
      callbackUrl: AUTH_ADMIN_CALLBACK_URL,
      csrfFieldName: "csrfToken",
      callbackUrlFieldName: "callbackUrl",
    },
  );
});
