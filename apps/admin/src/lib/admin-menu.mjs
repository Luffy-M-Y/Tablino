/**
 * @typedef {{ id: string, label: string, href: string, disabled: false } | { id: string, label: string, disabled: true, availabilityLabel: string }} AdminMenuEntry
 */

/** @type {readonly AdminMenuEntry[]} */
export const ADMIN_MENU_ITEMS = Object.freeze([
  Object.freeze({ id: "home", label: "Accueil", href: "/", disabled: false }),
  Object.freeze({ id: "structure", label: "Structure", href: "/structure", disabled: false }),
  Object.freeze({ id: "scan", label: "Scan", href: "/scan", disabled: false }),
  Object.freeze({ id: "upload", label: "Upload", href: "/upload", disabled: false }),
  Object.freeze({ id: "drafts", label: "Brouillons", href: "/drafts", disabled: false }),
  Object.freeze({ id: "resources", label: "Cours", href: "/resources", disabled: false }),
  Object.freeze({ id: "assignments", label: "Devoirs", href: "/assignments", disabled: false }),
  Object.freeze({ id: "codes", label: "Codes d'accès", href: "/codes", disabled: false }),
]);
