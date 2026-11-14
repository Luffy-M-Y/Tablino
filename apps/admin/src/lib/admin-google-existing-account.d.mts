import type { AdminHostContext } from "./admin-host-context";

export function getAdminGoogleExistingAccountEmail(options: {
  token: string | undefined;
  hostContext: AdminHostContext;
  verifyToken: (token: string) => { email: string; universityId: string } | null;
}): string | null;

export function getAdminGoogleExistingAccountMessage(
  email: string | null | undefined,
): string | null;
