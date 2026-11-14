import { isHostAllowedForUser } from "./host-access.mjs";

export const AUTH_ADMIN_RETURN_ERROR_PATH = "/login?error=google";

export function getAuthAdminReturnCode(searchParams) {
  if (!(searchParams instanceof URLSearchParams)) return null;
  const code = searchParams.get("code");
  return typeof code === "string" && code.length > 0 ? code : null;
}

export function resolveAuthAdminReturnDecision({
  code,
  hostContext,
  consumeResult,
  user,
}) {
  if (
    typeof code !== "string"
    || code.length === 0
    || hostContext?.kind !== "university"
    || !consumeResult?.userId
    || !user
    || user.id !== consumeResult.userId
    || user.role !== "university_admin"
    || user.revokedAt !== null
    || !isHostAllowedForUser(user, hostContext)
  ) {
    return { action: "redirect", path: AUTH_ADMIN_RETURN_ERROR_PATH };
  }

  return { action: "session", userId: user.id };
}
