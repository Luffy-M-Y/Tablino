export const SUPER_ADMIN_EDITOR_INVITATION_COOKIE: "tablino-admin-invitation-token";
export const SUPER_ADMIN_EDITOR_INVITATION_PATH: "/admin-invitation/accept";
export const SUPER_ADMIN_EDITOR_INVITATION_TTL_SECONDS: number;
export const SUPER_ADMIN_EDITOR_INVITATION_COOKIE_TTL_SECONDS: 540;

export function getSuperAdminEditorInvitationMessage(reason: string): string;
export function normalizeAdminRootDomain(value: unknown): string | null;
export function buildSuperAdminEditorInvitationUrl(
  rootDomain: unknown,
  token: unknown,
  secure: boolean,
): string | null;
export function getSuperAdminEditorInvitationCookieOptions(secure: boolean): {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: "/admin-invitation/accept";
  maxAge: number;
};
export function shouldClearSuperAdminEditorInvitationCookie(result: unknown): boolean;

export type InvitationCreationResult =
  | {
      ok: true;
      invitationId: string;
      email: string;
      token: string;
      expiresAt: Date;
    }
  | {
      ok: false;
      reason: "invalid_email" | "account_exists" | "inviter_not_allowed";
    };

export function runSuperAdminEditorInvitationFlow(input: {
  email: unknown;
  invitedByUserId: string;
  rootDomain: string;
  secure: boolean;
  createInvitation: (
    email: unknown,
    invitedByUserId: string,
  ) => Promise<InvitationCreationResult>;
  sendEmail: (to: string, url: string, expiresAt: Date) => Promise<void>;
  revokeInvitation: (invitationId: string) => Promise<boolean>;
}): Promise<
  | { ok: true }
  | {
      ok: false;
      reason:
        | "invalid_email"
        | "account_exists"
        | "inviter_not_allowed"
        | "invalid_root_domain"
        | "email_failed"
        | "email_revoke_failed";
    }
>;

export function runSuperAdminEditorInvitationAcceptance(input: {
  token: unknown;
  password: unknown;
  passwordConfirmation: unknown;
  clientIp: string | null;
  isProduction: boolean;
  checkRateLimit: (
    action: "login_ip",
    identifier: string,
  ) => Promise<{ allowed: boolean }>;
  recordFailure: (action: "login_ip", identifier: string) => Promise<unknown>;
  consumeInvitation: (
    token: unknown,
    password: unknown,
  ) => Promise<
    | { ok: true }
    | { ok: false; reason: "invalid_password" | "invitation_unavailable" }
  >;
}): Promise<{
  reason:
    | "ip_unavailable"
    | "rate_limited"
    | "invalid_password"
    | "password_mismatch"
    | "unavailable"
    | "accepted"
    | "invitation_unavailable";
  clearCookie: boolean;
}>;
