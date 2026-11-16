import { shouldClearAdminInvitationCookie } from "./admin-invitation-cookie.mjs";

export {
  getAdminInvitationMessage,
  getAdminInvitationRoleLabel,
} from "./admin-invitation-messages.mjs";
export {
  buildAdminInvitationUrl,
  normalizeAdminRootDomain,
} from "./admin-invitation-url.mjs";
export {
  getAdminInvitationCookieOptions,
  ADMIN_INVITATION_COOKIE,
  ADMIN_INVITATION_COOKIE_TTL_SECONDS,
  ADMIN_INVITATION_PATH,
  ADMIN_INVITATION_TTL_SECONDS,
  shouldClearAdminInvitationCookie,
} from "./admin-invitation-cookie.mjs";
export { runAdminInvitationFlow } from "./admin-invitation-flow.mjs";

export async function runAdminInvitationAcceptance({
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
    clearCookie: shouldClearAdminInvitationCookie(result),
  };
}
