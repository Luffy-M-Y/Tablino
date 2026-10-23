/**
 * @typedef {{ id: "structure" | "upload", title: string, description: string, href: string, active: true, disabled: false } | { id: "scanner", title: string, active: false, disabled: true, availabilityLabel: string }} AdminHomeCard
 */

/** @type {readonly AdminHomeCard[]} */
export const ADMIN_HOME_CARDS = Object.freeze([
  Object.freeze({
    id: "structure",
    title: "Structure",
    description: "Gérer filières, cycles et niveaux",
    href: "/structure",
    active: true,
    disabled: false,
  }),
  Object.freeze({
    id: "upload",
    title: "Uploader un fichier",
    description: "Envoyer un cours ou un devoir",
    href: "/upload",
    active: true,
    disabled: false,
  }),
  Object.freeze({
    id: "scanner",
    title: "Scanner",
    active: false,
    disabled: true,
    availabilityLabel: "Bientôt disponible",
  }),
]);
