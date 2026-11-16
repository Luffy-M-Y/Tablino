const PERMISSION_ROLES = Object.freeze({
  adminWorkspace: Object.freeze(["super_admin", "super_admin_editor", "university_admin"]),
  adminHome: Object.freeze([
    "super_admin",
    "super_admin_editor",
    "super_admin_lector",
    "university_admin",
  ]),
  lectorDashboard: Object.freeze(["super_admin_lector"]),
  globalDashboard: Object.freeze(["super_admin", "super_admin_editor"]),
  approvals: Object.freeze(["super_admin", "super_admin_editor"]),
  revenues: Object.freeze(["super_admin", "super_admin_editor"]),
  invitations: Object.freeze(["super_admin", "super_admin_editor"]),
  inviteLector: Object.freeze(["super_admin", "super_admin_editor"]),
  inviteEditor: Object.freeze(["super_admin"]),
  globalStructure: Object.freeze(["super_admin", "super_admin_editor"]),
  structure: Object.freeze(["super_admin", "super_admin_editor", "university_admin"]),
  files: Object.freeze(["super_admin", "super_admin_editor", "university_admin"]),
  drafts: Object.freeze(["super_admin", "super_admin_editor", "university_admin"]),
  partnership: Object.freeze([]),
});

export function getAdminPermissionRoles(permission) {
  if (
    typeof permission !== "string"
    || !Object.prototype.hasOwnProperty.call(PERMISSION_ROLES, permission)
  ) {
    return [];
  }
  return PERMISSION_ROLES[permission];
}

export function canRoleUseAdminPermission(role, permission) {
  return typeof role === "string" && getAdminPermissionRoles(permission).includes(role);
}
