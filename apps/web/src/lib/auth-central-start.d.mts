export const AUTH_CENTRAL_ROUTE_HEADER: "x-tablino-auth-central-route";
export const AUTH_TRANSACTION_COOKIE_NAME: "tablino-oauth-tx";
export const AUTH_TRANSACTION_MAX_AGE_SECONDS: 900;

export function createAuthCentralStartHandler(options: {
  consumeOauthStartTicket: (ticket: string) => Promise<string | null>;
  getSecret: () => string | undefined;
  secure: boolean;
  baseUrl?: string;
  authCentralHost?: string;
  now?: () => Date;
  fetchImpl?: typeof fetch;
  fetchTimeoutMs?: number;
}): (request: Request) => Promise<Response>;
