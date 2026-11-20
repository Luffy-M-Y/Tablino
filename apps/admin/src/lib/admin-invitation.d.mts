export {
  runStartAdminInvitationGoogle,
  ADMIN_INVITATION_GOOGLE_START_ERROR_MESSAGE,
  type StartAdminInvitationGoogleResult,
} from "./admin-invitation-google-start.mjs";

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
      auditId: string;
      email: string;
      role: AdminInvitationRole;
      token: string;
      expiresAt: Date;
    }
  | {
      ok: false;
      reason:
        | "invalid_email"
        | "invalid_role"
        | "account_exists"
        | "inviter_not_allowed"
        | "quota_exceeded";
    };

export function runAdminInvitationFlow(input: {
  email: unknown;
  invitedByUserId: string;
  role: AdminInvitationRole;
  clientIp: string | null;
  rootDomain: string;
  secure: boolean;
  createInvitation: (
    email: unknown,
    invitedByUserId: string,
    role: AdminInvitationRole,
    clientIp: string | null,
  ) => Promise<InvitationCreationResult>;
  sendEmail: (
    to: string,
    url: string,
    expiresAt: Date,
    role: AdminInvitationRole,
  ) => Promise<void>;
  enqueueAlerts: (auditId: string) => Promise<unknown>;
  processAlerts: () => Promise<unknown>;
}): Promise<
  | {
      ok: true;
      emailSent: boolean;
      invitationId: string;
      sendError: "invalid_root_domain" | "email_failed" | null;
    }
  | {
      ok: false;
      reason:
        | "invalid_email"
        | "invalid_role"
        | "account_exists"
        | "inviter_not_allowed"
        | "quota_exceeded"
        | "invalid_root_domain";
    }
>;

export type InvitationAcceptanceStage = "start" | "verify" | "resend";

export type InvitationAcceptanceOutcome = {
  reason:
    | "ip_unavailable"
    | "rate_limited"
    | "invalid_password"
    | "password_mismatch"
    | "invitation_unavailable"
    | "too_soon"
    | "code_unavailable"
    | "invalid_input"
    | "invalid_code"
    | "code_sent"
    | "code_resent"
    | "accepted";
  clearCookie: boolean;
  step: "password" | "code";
  email?: string;
  code?: string;
  role?: AdminInvitationRole;
};

export function runAdminInvitationAcceptance(input: {
  stage: InvitationAcceptanceStage;
  token: unknown;
  password: unknown;
  passwordConfirmation: unknown;
  code: unknown;
  clientIp: string | null;
  isProduction: boolean;
  checkRateLimit: (
    action: "login_ip",
    identifier: string,
  ) => Promise<{ allowed: boolean }>;
  recordFailure: (action: "login_ip", identifier: string) => Promise<unknown>;
  startAcceptance: (
    token: unknown,
    password: unknown,
    passwordConfirmation: unknown,
  ) => Promise<
    | { ok: true; email: string; code: string }
    | {
        ok: false;
        reason: "invalid_password" | "password_mismatch" | "invitation_unavailable" | "too_soon";
      }
  >;
  resendCode: (
    token: unknown,
  ) => Promise<
    | { ok: true; email: string; code: string }
    | { ok: false; reason: "invitation_unavailable" | "too_soon" }
  >;
  consumeCode: (
    token: unknown,
    code: unknown,
  ) => Promise<
    | { ok: true; role: AdminInvitationRole }
    | {
        ok: false;
        reason: "invalid_input" | "invitation_unavailable" | "code_unavailable" | "invalid_code";
      }
  >;
}): Promise<InvitationAcceptanceOutcome>;
