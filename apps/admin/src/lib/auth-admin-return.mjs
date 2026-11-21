import { isHostAllowedForUser } from "./host-access.mjs";

export const AUTH_ADMIN_RETURN_ERROR_PATH = "/login?error=google";

export function getAuthAdminReturnCode(searchParams) {
  if (!(searchParams instanceof URLSearchParams)) return null;
  const code = searchParams.get("code");
  return typeof code === "string" && code.length > 0 ? code : null;
}

export function resolveAuthAdminReturnDecision({
  code,
  flow,
  hostContext,
  consumeResult,
  user,
}) {
  if (
    typeof code !== "string"
    || code.length === 0
    || !consumeResult?.userId
    || !user
    || user.id !== consumeResult.userId
    || user.revokedAt !== null
    || !isHostAllowedForUser(user, hostContext)
  ) {
    return { action: "redirect", path: AUTH_ADMIN_RETURN_ERROR_PATH };
  }

  if (user.role === "super_admin") {
    return { action: "redirect", path: AUTH_ADMIN_RETURN_ERROR_PATH };
  }

  if (hostContext?.kind === "university") {
    const effectiveFlow = flow ?? "university";
    if (
      effectiveFlow !== "university"
      || user.role !== "university_admin"
      || user.universityId !== hostContext.universityId
    ) {
      return { action: "redirect", path: AUTH_ADMIN_RETURN_ERROR_PATH };
    }
  } else if (hostContext?.kind === "super") {
    if (flow !== "invitation" && flow !== "super_login") {
      return { action: "redirect", path: AUTH_ADMIN_RETURN_ERROR_PATH };
    }
    if (
      (user.role !== "super_admin_editor" && user.role !== "super_admin_lector")
      || user.universityId !== null
    ) {
      return { action: "redirect", path: AUTH_ADMIN_RETURN_ERROR_PATH };
    }
  } else {
    return { action: "redirect", path: AUTH_ADMIN_RETURN_ERROR_PATH };
  }

  return { action: "session", userId: user.id };
}
