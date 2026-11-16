import { shouldClearSuperAdminEditorInvitationCookie } from "./super-admin-editor-invitation-cookie.mjs";

export {
  getSuperAdminEditorInvitationMessage,
} from "./super-admin-editor-invitation-messages.mjs";
export {
  buildSuperAdminEditorInvitationUrl,
  normalizeAdminRootDomain,
} from "./super-admin-editor-invitation-url.mjs";
export {
  getSuperAdminEditorInvitationCookieOptions,
  SUPER_ADMIN_EDITOR_INVITATION_COOKIE,
  SUPER_ADMIN_EDITOR_INVITATION_COOKIE_TTL_SECONDS,
  SUPER_ADMIN_EDITOR_INVITATION_PATH,
  SUPER_ADMIN_EDITOR_INVITATION_TTL_SECONDS,
  shouldClearSuperAdminEditorInvitationCookie,
} from "./super-admin-editor-invitation-cookie.mjs";
export { runSuperAdminEditorInvitationFlow } from "./super-admin-editor-invitation-flow.mjs";

export async function runSuperAdminEditorInvitationAcceptance({
  token,
  password,
  passwordConfirmation,
  clientIp,
  isProduction,
  checkRateLimit,
  recordFailure,
  consumeInvitation,
}) {
  if (clientIp === null && isProduction) {
    return { reason: "ip_unavailable", clearCookie: false };
  }

  if (clientIp !== null) {
    const ipLimit = await checkRateLimit("login_ip", clientIp);
    if (!ipLimit.allowed) {
      return { reason: "rate_limited", clearCookie: false };
    }
  }

  if (
    typeof password !== "string"
    || typeof passwordConfirmation !== "string"
    || password.length === 0
    || passwordConfirmation.length === 0
  ) {
    return { reason: "invalid_password", clearCookie: false };
  }
  if (password !== passwordConfirmation) {
    return { reason: "password_mismatch", clearCookie: false };
  }
  if (typeof token !== "string" || token.length === 0) {
    return { reason: "unavailable", clearCookie: false };
  }

  const result = await consumeInvitation(token, password);
  if (
    result.ok === false
    && result.reason === "invitation_unavailable"
    && clientIp !== null
  ) {
    await recordFailure("login_ip", clientIp);
  }

  return {
    reason: result.ok ? "accepted" : result.reason,
    clearCookie: shouldClearSuperAdminEditorInvitationCookie(result),
  };
}
