export function isAdminInvitationOutboxAuthorized(
  authorization: string | null,
  configuredSecret: string | undefined,
): boolean;

export function runAdminInvitationOutboxRoute(input: {
  method: string;
  authorization: string | null;
  configuredSecret: string | undefined;
  processOutbox: () => Promise<unknown>;
}): Promise<{ status: 204 | 404 | 405 | 500 }>;
