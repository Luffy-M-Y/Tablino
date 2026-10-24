export type AdminMenuEntry =
  | { id: "home" | "structure" | "scan" | "upload" | "drafts" | "resources" | "assignments"; label: string; href: string; disabled: false }
  | { id: "scan"; label: string; disabled: true; availabilityLabel: "Bientôt disponible" };

export const ADMIN_MENU_ITEMS: readonly AdminMenuEntry[];
