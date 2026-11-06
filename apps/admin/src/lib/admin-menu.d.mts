export type AdminMenuEntry =
  | { id: "home" | "approvals" | "structure" | "scan" | "upload" | "drafts" | "resources" | "assignments" | "codes"; label: string; href: string; disabled: false; roles?: readonly string[] }
  | { id: "scan"; label: string; disabled: true; availabilityLabel: "Bientôt disponible"; roles?: readonly string[] };

export const ADMIN_MENU_ITEMS: readonly AdminMenuEntry[];

export function getAdminMenuItems(
  role: unknown,
  items?: readonly AdminMenuEntry[],
): readonly AdminMenuEntry[];
