export const AUTH_ADMIN_START_ERROR_MESSAGE: string;

export function createAuthAdminStartHandler(options: {
  consumeOauthStartTicket: (
    ticket: string,
    surface: "admin",
  ) => Promise<string | null>;
  getSecret: () => string | undefined;
  secure: boolean;
  baseUrl?: string;
  authAdminCentralHost?: string;
  now?: () => Date;
  fetchImpl?: typeof fetch;
  fetchTimeoutMs?: number;
}): (request: Request) => Promise<Response>;
