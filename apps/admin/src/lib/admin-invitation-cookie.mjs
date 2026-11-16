export const ADMIN_INVITATION_COOKIE =
  "tablino-admin-invitation-token";
export const ADMIN_INVITATION_PATH = "/admin-invitation/accept";
export const ADMIN_INVITATION_TTL_SECONDS = 48 * 60 * 60;
export const ADMIN_INVITATION_COOKIE_TTL_SECONDS = 540;

export function getAdminInvitationCookieOptions(secure) {
  return {
    httpOnly: true,
    secure: Boolean(secure),
    sameSite: "lax",
    path: ADMIN_INVITATION_PATH,
    maxAge: ADMIN_INVITATION_COOKIE_TTL_SECONDS,
  };
}

export function shouldClearAdminInvitationCookie(result) {
  return result?.ok === true
    || (result?.ok === false && result.reason === "invitation_unavailable");
}
