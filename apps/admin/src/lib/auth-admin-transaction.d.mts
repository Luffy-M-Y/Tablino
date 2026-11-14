export const AUTH_ADMIN_TRANSACTION_TTL_MS: number;
export const AUTH_ADMIN_TRANSACTION_COOKIE_NAME: "tablino-admin-oauth-tx";
export const AUTH_ADMIN_TRANSACTION_MAX_AGE_SECONDS: number;

export function createAuthAdminTransaction(options: {
  universityId: string;
  now: Date;
  secret: string;
}): string;

export function verifyAuthAdminTransaction(
  value: string | undefined,
  options: { now: Date; secret: string | undefined },
): string | null;
