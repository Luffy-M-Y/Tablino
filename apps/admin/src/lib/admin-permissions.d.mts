export type AdminPermission =
  | "adminWorkspace"
  | "adminHome"
  | "lectorDashboard"
  | "globalDashboard"
  | "approvals"
  | "revenues"
  | "invitations"
  | "inviteLector"
  | "inviteEditor"
  | "globalStructure"
  | "structure"
  | "files"
  | "drafts"
  | "partnership";

export type AdminPermissionRole =
  | "super_admin"
  | "super_admin_editor"
  | "super_admin_lector"
  | "university_admin";

export function getAdminPermissionRoles(
  permission: unknown,
): readonly AdminPermissionRole[];
export function canRoleUseAdminPermission(
  role: unknown,
  permission: unknown,
): boolean;
