"use server";

import { getCloudflareClientIp } from "@tablino/auth";
import {
  createAdminInvitation,
  enqueueAdminInvitationAlerts,
  processAdminInvitationAlertOutbox,
  verifyAdminInvitationStepUp,
} from "@tablino/db";
import {
  sendAdminInvitationAlertEmail,
  sendAdminInvitationEmail,
} from "@tablino/email";
import { headers } from "next/headers";
import { requireAdminPermission } from "@/lib/authorization";
import {
  runAdminInvitationAction,
  type AdminInvitationActionResult,
} from "@/lib/admin-invitation-action.mjs";
import {
  getAdminInvitationMessage,
  normalizeAdminRootDomain,
} from "@/lib/admin-invitation.mjs";

export type InviteAdminActionState = {
  status: "idle" | "success" | "error";
  message: string | null;
};

function readStringField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function getInvitationActionMessage(result: AdminInvitationActionResult): string {
  if (!result.ok) return getAdminInvitationMessage(result.reason);
  return getAdminInvitationMessage(
    result.emailSent ? "invitation_sent" : "invitation_created_email_failed",
  );
}

export async function inviteAdminAction(
  _previousState: InviteAdminActionState,
  formData: FormData,
): Promise<InviteAdminActionState> {
  const inviter = await requireAdminPermission("invitations");
  const rootDomain = normalizeAdminRootDomain(process.env.ADMIN_ROOT_DOMAIN);
  if (rootDomain === null) {
    return {
      status: "error",
      message: getAdminInvitationMessage("invalid_root_domain"),
    };
  }

  const requestHeaders = await headers();
  const clientIp = getCloudflareClientIp(requestHeaders);
  const result = await runAdminInvitationAction({
    actor: inviter,
    email: readStringField(formData, "email"),
    role: readStringField(formData, "role"),
    password: readStringField(formData, "password"),
    clientIp,
    rootDomain,
    secure: process.env.NODE_ENV === "production",
    verifyStepUp: verifyAdminInvitationStepUp,
    createInvitation: createAdminInvitation,
    sendEmail: sendAdminInvitationEmail,
    enqueueAlerts: enqueueAdminInvitationAlerts,
    processAlerts: async () => processAdminInvitationAlertOutbox(
      (alert) => sendAdminInvitationAlertEmail(alert.recipientEmail, {
        inviterEmail: alert.inviterEmail,
        invitedEmail: alert.invitedEmail,
        role: alert.role,
        invitedAt: alert.invitedAt,
      }),
    ),
  });

  return result.ok
    ? { status: "success", message: getInvitationActionMessage(result) }
    : { status: "error", message: getAdminInvitationMessage(result.reason) };
}
