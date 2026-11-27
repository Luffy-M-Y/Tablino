export const AUTH_ADMIN_START_ERROR_MESSAGE: string;

export function getAuthAdminStartUrl(
  authAdminCentralHost: string | undefined,
  options: { secure: boolean },
): string | null;

export function createAuthAdminStartHandler(options: {
  consumeOauthStartTicket: (
    ticket: string,
    surface: "admin",
  ) => Promise<string | null>;
  consumeAdminInvitationOauthStartTicket?: (
    ticket: string,
  ) => Promise<{ invitationId: string; transactionId: string } | null>;
  consumeAdminSuperLoginOauthStartTicket?: (
    ticket: string,
  ) => Promise<{ transactionId: string } | null>;
  verifyUniversitySignupStartTicket?: (
    ticket: string,
    options: { now: Date; secret: string },
  ) => boolean;
  getSecret: () => string | undefined;
  secure: boolean;
  baseUrl?: string;
  authAdminCentralHost?: string;
  now?: () => Date;
  fetchImpl?: typeof fetch;
  fetchTimeoutMs?: number;
}): (request: Request) => Promise<Response>;
