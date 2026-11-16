/**
 * @param {{ role: string, universityId: string | null, revokedAt: Date | null }} user
 * @param {{ kind: "super" } | { kind: "university", universityId: string } | null} hostContext
 * @returns {boolean}
 */
export function isSuperAdminLectorDashboardAllowed({ role, universityId, revokedAt }, hostContext) {
  return role === "super_admin_lector"
    && universityId === null
    && revokedAt === null
    && hostContext?.kind === "super";
}
