"use server";

import {
  createSuperAdminEditorInvitation,
  revokeSuperAdminEditorInvitation,
} from "@tablino/db";
import { sendSuperAdminEditorInvitationEmail } from "@tablino/email";
import { requireSuperAdminAccess } from "@/lib/authorization";
import {
  getSuperAdminEditorInvitationMessage,
  normalizeAdminRootDomain,
  runSuperAdminEditorInvitationFlow,
} from "@/lib/super-admin-editor-invitation.mjs";

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
  const inviter = await requireSuperAdminAccess();

  const rootDomain = process.env.ADMIN_ROOT_DOMAIN?.trim() ?? "";
  if (!rootDomain) {
    return {
      status: "error",
      message: getSuperAdminEditorInvitationMessage("missing_root_domain"),
    };
  }
  if (normalizeAdminRootDomain(rootDomain) === null) {
    return {
      status: "error",
      message: getSuperAdminEditorInvitationMessage("invalid_root_domain"),
    };
  }

  const result = await runSuperAdminEditorInvitationFlow({
    email: readEmail(formData),
    invitedByUserId: inviter.id,
    rootDomain,
    secure: process.env.NODE_ENV === "production",
    createInvitation: createSuperAdminEditorInvitation,
    sendEmail: sendSuperAdminEditorInvitationEmail,
    revokeInvitation: revokeSuperAdminEditorInvitation,
  });

  return result.ok
    ? {
        status: "success",
        message: getSuperAdminEditorInvitationMessage("invitation_sent"),
      }
    : {
        status: "error",
        message: getSuperAdminEditorInvitationMessage(result.reason),
      };
}
