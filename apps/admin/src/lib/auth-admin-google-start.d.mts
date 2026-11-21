import type { AdminHostContext } from "./admin-host-context";

export const AUTH_ADMIN_GOOGLE_START_ERROR_MESSAGE: string;

export type StartAdminGoogleSignInResult =
  | { ok: true; action: string; ticket: string; kind: "university" | "super_login" }
  | { ok: false; message: string };

export function runStartAdminGoogleSignIn(options: {
  getHostContext: () => Promise<AdminHostContext>;
  createTicket: (universityId: string, surface: "admin") => Promise<string>;
  createSuperLoginTicket?: () => Promise<string | null>;
  getCentralHost: () => string | undefined;
  secure: boolean;
}): Promise<StartAdminGoogleSignInResult>;
