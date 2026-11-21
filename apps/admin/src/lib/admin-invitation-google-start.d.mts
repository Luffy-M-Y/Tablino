import type { AdminHostContext } from "./admin-host-context";

export const ADMIN_INVITATION_GOOGLE_START_ERROR_MESSAGE: string;

export type StartAdminInvitationGoogleResult =
  | { ok: true; action: string; ticket: string; kind: "invitation" }
  | { ok: false; message: string };

export function runStartAdminInvitationGoogle(options: {
  getHostContext: () => Promise<AdminHostContext>;
  getToken: () => Promise<string | undefined> | string | undefined;
  createTicket: (token: string) => Promise<string | null>;
  getCentralHost: () => string | undefined;
  secure: boolean;
}): Promise<StartAdminInvitationGoogleResult>;
