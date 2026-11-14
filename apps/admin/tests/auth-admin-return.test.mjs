import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTH_ADMIN_RETURN_ERROR_PATH,
  getAuthAdminReturnCode,
  resolveAuthAdminReturnDecision,
} from "../src/lib/auth-admin-return.mjs";

const HOST_CONTEXT = { kind: "university", universityId: "university-test" };
const USER = {
  id: "admin-test",
  role: "university_admin",
  universityId: "university-test",
  revokedAt: null,
};
const CONSUMED = { userId: USER.id };

test("admin return extracts a non-empty transfer code", () => {
  assert.equal(getAuthAdminReturnCode(new URLSearchParams("code=abc")), "abc");
  assert.equal(getAuthAdminReturnCode(new URLSearchParams("code=")), null);
  assert.equal(getAuthAdminReturnCode(null), null);
});

test("admin return permits only a valid, active university administrator on the matching host", () => {
  assert.deepEqual(
    resolveAuthAdminReturnDecision({
      code: "transfer-code",
      hostContext: HOST_CONTEXT,
      consumeResult: CONSUMED,
      user: USER,
    }),
    { action: "session", userId: USER.id },
  );
});

test("admin return uses the same generic login failure for invalid host, role, scope, and revocation", () => {
  const invalidCases = [
    { code: null, hostContext: HOST_CONTEXT, consumeResult: CONSUMED, user: USER },
    { code: "code", hostContext: null, consumeResult: CONSUMED, user: USER },
    { code: "code", hostContext: { kind: "super" }, consumeResult: CONSUMED, user: USER },
    { code: "code", hostContext: HOST_CONTEXT, consumeResult: null, user: USER },
    {
      code: "code",
      hostContext: HOST_CONTEXT,
      consumeResult: CONSUMED,
      user: { ...USER, role: "student" },
    },
    {
      code: "code",
      hostContext: HOST_CONTEXT,
      consumeResult: CONSUMED,
      user: { ...USER, universityId: "other-university" },
    },
    {
      code: "code",
      hostContext: HOST_CONTEXT,
      consumeResult: CONSUMED,
      user: { ...USER, revokedAt: new Date() },
    },
    {
      code: "code",
      hostContext: HOST_CONTEXT,
      consumeResult: CONSUMED,
      user: { ...USER, id: "other-user" },
    },
  ];

  for (const input of invalidCases) {
    assert.deepEqual(resolveAuthAdminReturnDecision(input), {
      action: "redirect",
      path: AUTH_ADMIN_RETURN_ERROR_PATH,
    });
  }
});
