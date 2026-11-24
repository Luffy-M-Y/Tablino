/**
 * Situe un admin d'université par rapport à l'hôte courant.
 *
 * @param {{ role: string | null, universityId: string | null, revokedAt: Date | null } | null} account
 * @param {{ kind: "super" } | { kind: "university", universityId: string } | null} hostContext
 * @returns {"not_university_admin" | "own_host" | "other_host"}
 */
export function resolveUniversityAdminHost(account, hostContext) {
  if (
    account === null
    || typeof account !== "object"
    || account.role !== "university_admin"
    || typeof account.universityId !== "string"
    || account.universityId.length === 0
    || account.revokedAt !== null
  ) {
    return "not_university_admin";
  }

  if (
    hostContext !== null
    && typeof hostContext === "object"
    && hostContext.kind === "university"
    && hostContext.universityId === account.universityId
  ) {
    return "own_host";
  }
  return "other_host";
}

/**
 * Décide la suite de la page « Accès refusé ». Les redirections vers
 * /university-pending et /partenariat n'ont lieu que sur l'hôte de
 * l'université, sinon elles bouclent.
 *
 * @param {{ role: string | null, universityId: string | null, revokedAt: Date | null, universityStatus: string | null } | null} account
 * @param {{ kind: "super" } | { kind: "university", universityId: string } | null} hostContext
 * @returns {"none" | "pending" | "partnership" | "university_host"}
 */
export function resolveForbiddenTarget(account, hostContext) {
  const placement = resolveUniversityAdminHost(account, hostContext);
  if (placement === "not_university_admin") return "none";
  if (placement === "other_host") return "university_host";
  if (account.universityStatus === "pending") return "pending";
  if (account.universityStatus === "approved") return "partnership";
  return "none";
}
