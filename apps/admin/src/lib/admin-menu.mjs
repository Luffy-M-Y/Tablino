/**
 * @typedef {{ id: string, label: string, href: string, disabled: false, roles?: readonly string[] } | { id: string, label: string, disabled: true, availabilityLabel: string, roles?: readonly string[] }} AdminMenuEntry
 */

/** @type {readonly AdminMenuEntry[]} */
export const ADMIN_MENU_ITEMS = Object.freeze([
  Object.freeze({ id: "home", label: "Accueil", href: "/", disabled: false, roles: Object.freeze(["super_admin", "university_admin"]) }),
  Object.freeze({ id: "approvals", label: "Validations", href: "/approvals", disabled: false, roles: Object.freeze(["super_admin"]) }),
  Object.freeze({ id: "structure", label: "Structure", href: "/structure", disabled: false, roles: Object.freeze(["university_admin"]) }),
  Object.freeze({ id: "scan", label: "Scan", href: "/scan", disabled: false, roles: Object.freeze(["university_admin"]) }),
  Object.freeze({ id: "upload", label: "Upload", href: "/upload", disabled: false, roles: Object.freeze(["university_admin"]) }),
  Object.freeze({ id: "drafts", label: "Brouillons", href: "/drafts", disabled: false, roles: Object.freeze(["university_admin"]) }),
  Object.freeze({ id: "resources", label: "Cours", href: "/resources", disabled: false, roles: Object.freeze(["university_admin"]) }),
  Object.freeze({ id: "assignments", label: "Devoirs", href: "/assignments", disabled: false, roles: Object.freeze(["university_admin"]) }),
  Object.freeze({ id: "codes", label: "Codes d'accès", href: "/codes", disabled: false, roles: Object.freeze(["university_admin"]) }),
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
