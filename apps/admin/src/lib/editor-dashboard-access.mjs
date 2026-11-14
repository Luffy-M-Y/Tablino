/**
 * @param {{ role: string, universityId: string | null, revokedAt: Date | null }} user
 * @param {{ kind: "super" } | { kind: "university", universityId: string } | null} hostContext
 * @returns {boolean}
 */
export function isSuperAdminEditorDashboardAllowed({ role, universityId, revokedAt }, hostContext) {
  return role === "super_admin_editor"
    && universityId === null
    && revokedAt === null
    && hostContext?.kind === "super";
}
