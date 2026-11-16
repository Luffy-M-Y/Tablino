"use server";

import {
  createAdminInvitation,
  revokeAdminInvitation,
} from "@tablino/db";
import { sendAdminInvitationEmail } from "@tablino/email";
import { requireAdminPermission } from "@/lib/authorization";
import {
  getAdminInvitationMessage,
  normalizeAdminRootDomain,
  runAdminInvitationFlow,
} from "@/lib/admin-invitation.mjs";

export type InviteAdminActionState = {
  status: "idle" | "success" | "error";
  message: string | null;
};

function readEmail(formData: FormData): string {
  const value = formData.get("email");
  return typeof value === "string" ? value : "";
}

export async function inviteAdminAction(
  _previousState: InviteAdminActionState,
  formData: FormData,
): Promise<InviteAdminActionState> {
  const inviter = await requireAdminPermission("inviteLector");

  const rootDomain = process.env.ADMIN_ROOT_DOMAIN?.trim() ?? "";
  if (!rootDomain) {
    return {
      status: "error",
      message: getAdminInvitationMessage("missing_root_domain"),
    };
  }
  if (normalizeAdminRootDomain(rootDomain) === null) {
    return {
      status: "error",
      message: getAdminInvitationMessage("invalid_root_domain"),
    };
  }

  const result = await runAdminInvitationFlow({
    email: readEmail(formData),
    invitedByUserId: inviter.id,
    rootDomain,
    secure: process.env.NODE_ENV === "production",
    createInvitation: createAdminInvitation,
    sendEmail: sendAdminInvitationEmail,
    revokeInvitation: revokeAdminInvitation,
  });

  return result.ok
    ? {
        status: "success",
        message: getAdminInvitationMessage("invitation_sent"),
      }
    : {
        status: "error",
        message: getAdminInvitationMessage(result.reason),
      };
}
