/**
 * Retourne la raison du refus hôte, ou null si l'accès est autorisé.
 *
 * @param {{ role: string | null | undefined, universityId: string | null | undefined }} user
 * @param {{ kind: "super" } | { kind: "university", universityId: string } | null} hostContext
 * @returns {string | null}
 */
export function getHostDenialReason(user, hostContext) {
  if (hostContext === null) return "host_context_null";

  if (user.role === "super_admin") {
    return hostContext.kind === "super" ? null : "super_admin_not_on_super_host";
  }

  if (user.role === "university_admin") {
    if (hostContext.kind !== "university") return "university_admin_not_on_university_host";
    if (!user.universityId) return "university_admin_without_university";
    if (hostContext.universityId !== user.universityId) return "university_mismatch";
    return null;
  }

  return "unknown_role";
}

/**
 * Décide si un utilisateur est autorisé sur un contexte d'hôte admin.
 *
 * @param {{ role: string | null | undefined, universityId: string | null | undefined }} user
 * @param {{ kind: "super" } | { kind: "university", universityId: string } | null} hostContext
 * @returns {boolean}
 */
export function isHostAllowedForUser(user, hostContext) {
  return getHostDenialReason(user, hostContext) === null;
}
