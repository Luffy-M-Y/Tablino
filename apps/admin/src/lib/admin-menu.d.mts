export type AdminMenuEntry =
  | {
      id:
        | "home"
        | "approvals"
        | "revenues"
        | "admin-invitations"
        | "structure"
        | "scan"
        | "upload"
        | "drafts"
        | "resources"
        | "assignments"
        | "codes";
      label: string;
      href: string;
      icon: string;
      disabled: false;
      roles?: readonly string[];
      permission?: string;
    }
  | {
      id: "scan";
      label: string;
      icon: string;
      disabled: true;
      availabilityLabel: "Bientôt disponible";
      roles?: readonly string[];
    };

export const ADMIN_MENU_ITEMS: readonly AdminMenuEntry[];

export function getAdminMenuItems(
  role: unknown,
  items?: readonly AdminMenuEntry[],
): readonly AdminMenuEntry[];

export function shouldShowAdminHeaderNavigation(role: unknown): boolean;
