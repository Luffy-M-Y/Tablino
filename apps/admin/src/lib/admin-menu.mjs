import {
  canRoleUseAdminPermission,
  getAdminPermissionRoles,
} from "./admin-permissions.mjs";

/**
 * @typedef {{ id: string, label: string, href: string, icon: "LayoutDashboard" | "UserCheck" | "UserPlus" | "DollarSign" | "Layers" | "ScanLine" | "Upload" | "FilePen" | "BookOpen" | "ClipboardList" | "KeyRound", disabled: false, roles?: readonly string[], permission?: string } | { id: string, label: string, icon: "LayoutDashboard" | "UserCheck" | "UserPlus" | "DollarSign" | "Layers" | "ScanLine" | "Upload" | "FilePen" | "BookOpen" | "ClipboardList" | "KeyRound", disabled: true, availabilityLabel: string, roles?: readonly string[] }} AdminMenuEntry
 */

/** @type {readonly AdminMenuEntry[]} */
export const ADMIN_MENU_ITEMS = Object.freeze([
  Object.freeze({ id: "home", label: "Accueil", href: "/", icon: "LayoutDashboard", disabled: false, permission: "adminHome", roles: getAdminPermissionRoles("adminHome") }),
  Object.freeze({ id: "approvals", label: "Validations", href: "/approvals", icon: "UserCheck", disabled: false, permission: "approvals", roles: getAdminPermissionRoles("approvals") }),
  Object.freeze({ id: "revenues", label: "Revenus", href: "/revenus", icon: "DollarSign", disabled: false, permission: "revenues", roles: getAdminPermissionRoles("revenues") }),
  Object.freeze({ id: "admin-invitations", label: "Ajouter un admin", href: "/admin-invitations", icon: "UserPlus", disabled: false, permission: "invitations", roles: getAdminPermissionRoles("invitations") }),
  Object.freeze({ id: "structure", label: "Structure", href: "/structure", icon: "Layers", disabled: false, roles: Object.freeze(["university_admin"]) }),
  Object.freeze({ id: "scan", label: "Scan", href: "/scan", icon: "ScanLine", disabled: false, roles: Object.freeze(["university_admin"]) }),
  Object.freeze({ id: "upload", label: "Upload", href: "/upload", icon: "Upload", disabled: false, roles: Object.freeze(["university_admin"]) }),
  Object.freeze({ id: "drafts", label: "Brouillons", href: "/drafts", icon: "FilePen", disabled: false, roles: Object.freeze(["university_admin"]) }),
  Object.freeze({ id: "resources", label: "Cours", href: "/resources", icon: "BookOpen", disabled: false, roles: Object.freeze(["university_admin"]) }),
  Object.freeze({ id: "assignments", label: "Devoirs", href: "/assignments", icon: "ClipboardList", disabled: false, roles: Object.freeze(["university_admin"]) }),
  Object.freeze({ id: "codes", label: "Codes d'accès", href: "/codes", icon: "KeyRound", disabled: false, roles: Object.freeze(["university_admin"]) }),
]);

/**
 * Filtre les éléments du menu d'administration selon le rôle utilisateur.
 * @param {unknown} role
 * @param {readonly AdminMenuEntry[]} [items=ADMIN_MENU_ITEMS]
 * @returns {readonly AdminMenuEntry[]}
 */
export function getAdminMenuItems(role, items = ADMIN_MENU_ITEMS) {
  if (typeof role !== "string" || !Array.isArray(items)) return [];
  return items.filter((item) => Array.isArray(item.roles) && item.roles.includes(role));
}

/**
 * @param {unknown} role
 */
export function shouldShowAdminHeaderNavigation(role) {
  return typeof role === "string"
    && canRoleUseAdminPermission(role, "adminHome")
    && (
      canRoleUseAdminPermission(role, "globalDashboard")
      || !canRoleUseAdminPermission(role, "adminWorkspace")
    );
}
