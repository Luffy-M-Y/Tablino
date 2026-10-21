export type AdminHomeCard =
  | {
      id: "structure";
      title: string;
      description: string;
      href: string;
      active: true;
      disabled: false;
    }
  | {
      id: "upload" | "scanner";
      title: string;
      active: false;
      disabled: true;
      availabilityLabel: "Bientôt disponible";
    };

export const ADMIN_HOME_CARDS: readonly AdminHomeCard[];
