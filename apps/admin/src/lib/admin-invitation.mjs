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
export {
  runStartAdminInvitationGoogle,
  ADMIN_INVITATION_GOOGLE_START_ERROR_MESSAGE,
} from "./admin-invitation-google-start.mjs";

export async function runAdminInvitationAcceptance({
  stage,
  token,
  password,
  passwordConfirmation,
  code,
  clientIp,
  isProduction,
  checkRateLimit,
  recordFailure,
  startAcceptance,
  resendCode,
  consumeCode,
}) {
  if (stage !== "start" && stage !== "verify" && stage !== "resend") {
    return { reason: "invitation_unavailable", clearCookie: false, step: "password" };
  }

  if (clientIp === null && isProduction) {
    return { reason: "ip_unavailable", clearCookie: false, step: stage === "start" ? "password" : "code" };
  }

  if (clientIp !== null) {
    const ipLimit = await checkRateLimit("login_ip", clientIp);
    if (!ipLimit.allowed) {
      return { reason: "rate_limited", clearCookie: false, step: stage === "start" ? "password" : "code" };
    }
  }

  if (stage === "start") {
    const result = await startAcceptance(token, password, passwordConfirmation);
    if (!result.ok) {
      if (result.reason === "invitation_unavailable" && clientIp !== null) {
        await recordFailure("login_ip", clientIp);
      }
      return {
        reason: result.reason,
        clearCookie: result.reason === "invitation_unavailable",
        step: result.reason === "too_soon" ? "code" : "password",
      };
    }
    return {
      reason: "code_sent",
      clearCookie: false,
      step: "code",
      email: result.email,
      code: result.code,
    };
  }

  if (stage === "resend") {
    const result = await resendCode(token);
    if (!result.ok) {
      if (result.reason === "invitation_unavailable" && clientIp !== null) {
        await recordFailure("login_ip", clientIp);
      }
      return {
        reason: result.reason,
        clearCookie: result.reason === "invitation_unavailable",
        step: "code",
      };
    }
    return {
      reason: "code_resent",
      clearCookie: false,
      step: "code",
      email: result.email,
      code: result.code,
    };
  }

  const result = await consumeCode(token, code);
  if (
    result.ok === false
    && result.reason === "invitation_unavailable"
    && clientIp !== null
  ) {
    await recordFailure("login_ip", clientIp);
  }
  return {
    reason: result.ok ? "accepted" : result.reason,
    clearCookie: result.ok || result.reason === "invitation_unavailable",
    step: "code",
    role: result.ok ? result.role : undefined,
  };
}
