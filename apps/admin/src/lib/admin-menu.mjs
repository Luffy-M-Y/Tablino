/**
 * @typedef {{ id: string, label: string, href: string, disabled: false } | { id: string, label: string, disabled: true, availabilityLabel: string }} AdminMenuEntry
 */

/** @type {readonly AdminMenuEntry[]} */
export const ADMIN_MENU_ITEMS = Object.freeze([
  Object.freeze({ id: "home", label: "Accueil", href: "/", disabled: false }),
  Object.freeze({ id: "structure", label: "Structure", href: "/structure", disabled: false }),
  Object.freeze({ id: "scan", label: "Scan", disabled: true, availabilityLabel: "Bientôt disponible" }),
  Object.freeze({ id: "upload", label: "Upload", disabled: true, availabilityLabel: "Bientôt disponible" }),
]);
