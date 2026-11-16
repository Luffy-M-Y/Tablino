import assert from "node:assert/strict";
import test from "node:test";
import {
  getSuperAdminEditorInvitationCookieOptions,
  shouldClearSuperAdminEditorInvitationCookie,
  SUPER_ADMIN_EDITOR_INVITATION_COOKIE,
  SUPER_ADMIN_EDITOR_INVITATION_COOKIE_TTL_SECONDS,
  SUPER_ADMIN_EDITOR_INVITATION_PATH,
} from "../src/lib/super-admin-editor-invitation.mjs";

test("configures an HTTP-only, same-site invitation cookie for the full flow", () => {
  assert.equal(SUPER_ADMIN_EDITOR_INVITATION_COOKIE, "tablino-admin-invitation-token");
  assert.equal(SUPER_ADMIN_EDITOR_INVITATION_COOKIE_TTL_SECONDS, 540);
  assert.equal(SUPER_ADMIN_EDITOR_INVITATION_PATH, "/admin-invitation/accept");
  assert.deepEqual(getSuperAdminEditorInvitationCookieOptions(true), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/admin-invitation/accept",
    maxAge: 540,
  });
});

test("clears the cookie only after success or an unavailable consumption result", () => {
  assert.equal(shouldClearSuperAdminEditorInvitationCookie({ ok: true }), true);
  assert.equal(
    shouldClearSuperAdminEditorInvitationCookie({
      ok: false,
      reason: "invitation_unavailable",
    }),
    true,
  );
  assert.equal(
    shouldClearSuperAdminEditorInvitationCookie({
      ok: false,
      reason: "invalid_password",
    }),
    false,
  );
  assert.equal(shouldClearSuperAdminEditorInvitationCookie(null), false);
});
