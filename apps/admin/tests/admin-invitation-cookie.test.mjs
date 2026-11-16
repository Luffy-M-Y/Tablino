import assert from "node:assert/strict";
import test from "node:test";
import {
  getAdminInvitationCookieOptions,
  shouldClearAdminInvitationCookie,
  ADMIN_INVITATION_COOKIE,
  ADMIN_INVITATION_COOKIE_TTL_SECONDS,
  ADMIN_INVITATION_PATH,
  ADMIN_INVITATION_TTL_SECONDS,
} from "../src/lib/admin-invitation.mjs";

test("configures an HTTP-only, same-site invitation cookie for the full flow", () => {
  assert.equal(ADMIN_INVITATION_COOKIE, "tablino-admin-invitation-token");
  assert.equal(ADMIN_INVITATION_COOKIE_TTL_SECONDS, 540);
  assert.equal(ADMIN_INVITATION_TTL_SECONDS, 48 * 60 * 60);
  assert.equal(ADMIN_INVITATION_PATH, "/admin-invitation/accept");
  assert.deepEqual(getAdminInvitationCookieOptions(true), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/admin-invitation/accept",
    maxAge: 540,
  });
});

test("clears the cookie only after success or an unavailable consumption result", () => {
  assert.equal(shouldClearAdminInvitationCookie({ ok: true }), true);
  assert.equal(
    shouldClearAdminInvitationCookie({
      ok: false,
      reason: "invitation_unavailable",
    }),
    true,
  );
  assert.equal(
    shouldClearAdminInvitationCookie({
      ok: false,
      reason: "invalid_password",
    }),
    false,
  );
  assert.equal(shouldClearAdminInvitationCookie(null), false);
});
