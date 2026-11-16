/**
 * @param {string | null | undefined} role
 * @returns {{ loadStoredValue: boolean, showControl: boolean }}
 */
export function getAdminSidebarPinPolicy(role) {
  const allowed = role === "super_admin" || role === "super_admin_editor" || role === "university_admin";
  return { loadStoredValue: allowed, showControl: allowed };
}
