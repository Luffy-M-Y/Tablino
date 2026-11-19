import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTH_ADMIN_RETURN_ERROR_PATH,
  getAuthAdminReturnCode,
  resolveAuthAdminReturnDecision,
} from "../src/lib/auth-admin-return.mjs";

const HOST_CONTEXT = { kind: "university", universityId: "university-test" };
const SUPER_HOST_CONTEXT = { kind: "super" };
const USER = {
  id: "admin-test",
  role: "university_admin",
  universityId: "university-test",
  revokedAt: null,
};
const SUPER_EDITOR = {
  id: "super-editor-test",
  role: "super_admin_editor",
  universityId: null,
  revokedAt: null,
};
const SUPER_LECTOR = {
  id: "super-lector-test",
  role: "super_admin_lector",
  universityId: null,
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

test("admin return enforces university isolation: rejects invitation and super_login flows on university host", () => {
  for (const crossFlow of ["invitation", "super_login", "other"]) {
    assert.deepEqual(
      resolveAuthAdminReturnDecision({
        code: "transfer-code",
        flow: crossFlow,
        hostContext: HOST_CONTEXT,
        consumeResult: CONSUMED,
        user: USER,
      }),
      { action: "redirect", path: AUTH_ADMIN_RETURN_ERROR_PATH },
    );
  }
});

test("admin return enforces super host isolation: rejects university flow or unknown flow on super host", () => {
  for (const invalidFlow of ["university", "unknown", undefined, null, ""]) {
    assert.deepEqual(
      resolveAuthAdminReturnDecision({
        code: "transfer-code",
        flow: invalidFlow,
        hostContext: SUPER_HOST_CONTEXT,
        consumeResult: { userId: SUPER_EDITOR.id },
        user: SUPER_EDITOR,
      }),
      { action: "redirect", path: AUTH_ADMIN_RETURN_ERROR_PATH },
    );
  }
});

test("admin return rejects super_admin role on super host", () => {
  const superAdminUser = {
    id: "chief-super-admin",
    role: "super_admin",
    universityId: null,
    revokedAt: null,
  };
  for (const flow of ["super_login", "invitation"]) {
    assert.deepEqual(
      resolveAuthAdminReturnDecision({
        code: "transfer-code",
        flow,
        hostContext: SUPER_HOST_CONTEXT,
        consumeResult: { userId: superAdminUser.id },
        user: superAdminUser,
      }),
      { action: "redirect", path: AUTH_ADMIN_RETURN_ERROR_PATH },
    );
  }
});

test("admin return rejects account with revokedAt non-null on super host", () => {
  const revokedEditor = {
    ...SUPER_EDITOR,
    revokedAt: new Date("2026-11-14T00:00:00.000Z"),
  };
  assert.deepEqual(
    resolveAuthAdminReturnDecision({
      code: "transfer-code",
      flow: "super_login",
      hostContext: SUPER_HOST_CONTEXT,
      consumeResult: { userId: revokedEditor.id },
      user: revokedEditor,
    }),
    { action: "redirect", path: AUTH_ADMIN_RETURN_ERROR_PATH },
  );
});

test("admin return permits valid super_login and invitation flows for eligible super roles on super host", () => {
  assert.deepEqual(
    resolveAuthAdminReturnDecision({
      code: "transfer-code-1",
      flow: "super_login",
      hostContext: SUPER_HOST_CONTEXT,
      consumeResult: { userId: SUPER_EDITOR.id },
      user: SUPER_EDITOR,
    }),
    { action: "session", userId: SUPER_EDITOR.id },
  );

  assert.deepEqual(
    resolveAuthAdminReturnDecision({
      code: "transfer-code-2",
      flow: "invitation",
      hostContext: SUPER_HOST_CONTEXT,
      consumeResult: { userId: SUPER_LECTOR.id },
      user: SUPER_LECTOR,
    }),
    { action: "session", userId: SUPER_LECTOR.id },
  );
});
