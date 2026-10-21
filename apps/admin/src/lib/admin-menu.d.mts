export type AdminMenuEntry =
  | { id: "home" | "structure"; label: string; href: string; disabled: false }
  | { id: "scan" | "upload"; label: string; disabled: true; availabilityLabel: "Bientôt disponible" };

export const ADMIN_MENU_ITEMS: readonly AdminMenuEntry[];
