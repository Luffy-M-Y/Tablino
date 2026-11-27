export const AUTH_ADMIN_TRANSACTION_TTL_MS: number;
export const AUTH_ADMIN_TRANSACTION_COOKIE_NAME: "tablino-admin-oauth-tx";
export const AUTH_ADMIN_TRANSACTION_MAX_AGE_SECONDS: number;
export const AUTH_ADMIN_FLOWS: readonly ["university", "invitation", "super_login", "university_signup"];

export type AuthAdminFlow = "university" | "invitation" | "super_login" | "university_signup";

export type AuthAdminTransactionPayload =
  | { flow: "university"; universityId: string }
  | { flow: "invitation"; invitationId: string; transactionId: string }
  | { flow: "super_login"; transactionId: string }
  | { flow: "university_signup" };

export function createAuthAdminTransaction(options:
  | { flow?: "university"; universityId: string; now: Date; secret: string }
  | { flow: "invitation"; invitationId: string; transactionId: string; now: Date; secret: string }
  | { flow: "super_login"; transactionId: string; now: Date; secret: string }
  | { flow: "university_signup"; now: Date; secret: string }
): string;

export function parseAuthAdminTransaction(
  value: string | undefined,
  options: { now: Date; secret: string | undefined },
): AuthAdminTransactionPayload | null;

export function verifyAuthAdminTransaction(
  value: string | undefined,
  options: { now: Date; secret: string | undefined; expectedFlow?: AuthAdminFlow },
): string | { invitationId: string; transactionId: string } | true | null;
