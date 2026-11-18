import type { AdminInvitationRole } from "@tablino/db";
import type { InvitationCreationResult } from "./admin-invitation.mjs";

export type AdminInvitationActionResult =
  | {
      ok: true;
      emailSent: boolean;
      invitationId: string;
      sendError: "invalid_root_domain" | "email_failed" | null;
    }
  | {
      ok: false;
      reason:
        | "invalid_role"
        | "inviter_not_allowed"
        | "step_up_no_password"
        | "step_up_invalid"
        | "step_up_rate_limited"
        | "invalid_root_domain"
        | "invalid_email"
        | "account_exists"
        | "quota_exceeded";
    };

export function getInvitableAdminRoles(
  actorRole: unknown,
): AdminInvitationRole[];

export function runAdminInvitationAction(input: {
  actor: { id: string; role: string };
  email: unknown;
  role: unknown;
  password: unknown;
  clientIp: string | null;
  rootDomain: string;
  secure: boolean;
  verifyStepUp: (
    userId: string,
    password: unknown,
  ) => Promise<
    | { ok: true }
    | {
        ok: false;
        reason: "not_allowed" | "no_password" | "invalid_password" | "rate_limited";
      }
  >;
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
}): Promise<AdminInvitationActionResult>;
