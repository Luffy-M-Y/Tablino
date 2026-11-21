"use server";

import {
  enqueueAdminRevocationAlerts,
  processAdminRevocationAlertOutbox,
  revokeSuperAdminAccount,
} from "@tablino/db";
import { sendAdminRevocationAlertEmail } from "@tablino/email";
import { revalidatePath } from "next/cache";
import { requireAdminPermission } from "@/lib/authorization";
import { runAdminRevocationAction } from "@/lib/admin-revocation-action.mjs";
import { getAdminRevocationMessage } from "@/lib/admin-revocation-messages.mjs";

export type RevokeAdminActionState = {
  status: "idle" | "success" | "error";
  message: string | null;
};

function readStringField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function revokeAdminAction(
  _previousState: RevokeAdminActionState,
  formData: FormData,
): Promise<RevokeAdminActionState> {
  const actor = await requireAdminPermission("admins");

  const targetId = readStringField(formData, "targetId");
  const password = readStringField(formData, "password");

  const result = await runAdminRevocationAction({
    actor,
    targetId,
    password,
    revokeAccount: revokeSuperAdminAccount,
    enqueueAlerts: enqueueAdminRevocationAlerts,
    processAlerts: async () => processAdminRevocationAlertOutbox(
      (alert) => sendAdminRevocationAlertEmail(
        alert.recipientEmail,
        {
          revokerEmail: alert.revokerEmail,
          revokedEmail: alert.revokedEmail,
          role: alert.revokedRole,
          revokedAt: alert.revokedAt,
        },
      ),
    ),
  });

  if (result.ok) {
    revalidatePath("/admins");
    return {
      status: "success",
      message: getAdminRevocationMessage(result.reason),
    };
  }

  return {
    status: "error",
    message: getAdminRevocationMessage(result.reason),
  };
}
