export type AdminInvitationRole = "super_admin_editor" | "super_admin_lector";

export const ADMIN_INVITATION_COOKIE: "tablino-admin-invitation-token";
export const ADMIN_INVITATION_PATH: "/admin-invitation/accept";
export const ADMIN_INVITATION_TTL_SECONDS: number;
export const ADMIN_INVITATION_COOKIE_TTL_SECONDS: 540;

export function getAdminInvitationMessage(reason: string, role?: unknown): string;
export function getAdminInvitationRoleLabel(role: unknown): string | null;
export function normalizeAdminRootDomain(value: unknown): string | null;
export function buildAdminInvitationUrl(
  rootDomain: unknown,
  token: unknown,
  secure: boolean,
): string | null;
export function getAdminInvitationCookieOptions(secure: boolean): {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: "/admin-invitation/accept";
  maxAge: number;
};
export function shouldClearAdminInvitationCookie(result: unknown): boolean;

export type InvitationCreationResult =
  | {
      ok: true;
      invitationId: string;
      email: string;
      role: AdminInvitationRole;
      token: string;
      expiresAt: Date;
    }
  | {
      ok: false;
      reason: "invalid_email" | "account_exists" | "inviter_not_allowed";
    };

export function runAdminInvitationFlow(input: {
  email: unknown;
  invitedByUserId: string;
  rootDomain: string;
  secure: boolean;
  createInvitation: (
    email: unknown,
    invitedByUserId: string,
  ) => Promise<InvitationCreationResult>;
  sendEmail: (
    to: string,
    url: string,
    expiresAt: Date,
    role: AdminInvitationRole,
  ) => Promise<void>;
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

export function runAdminInvitationAcceptance(input: {
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
    | { ok: true; role: AdminInvitationRole }
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
