export const SUPER_ADMIN_EDITOR_INVITATION_COOKIE =
  "tablino-admin-invitation-token";
export const SUPER_ADMIN_EDITOR_INVITATION_PATH = "/admin-invitation/accept";
export const SUPER_ADMIN_EDITOR_INVITATION_TTL_SECONDS = 48 * 60 * 60;
export const SUPER_ADMIN_EDITOR_INVITATION_COOKIE_TTL_SECONDS = 540;

export function getSuperAdminEditorInvitationCookieOptions(secure) {
  return {
    httpOnly: true,
    secure: Boolean(secure),
    sameSite: "lax",
    path: SUPER_ADMIN_EDITOR_INVITATION_PATH,
    maxAge: SUPER_ADMIN_EDITOR_INVITATION_COOKIE_TTL_SECONDS,
  };
}

export function shouldClearSuperAdminEditorInvitationCookie(result) {
  return result?.ok === true
    || (result?.ok === false && result.reason === "invitation_unavailable");
}
