"use server";

import { approveUniversity } from "@tablino/db";
import { sendUniversityApprovedEmail } from "@tablino/email";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuperAdminAccess } from "@/lib/authorization";
import { resolveApprovalEmailStatus } from "@/lib/approval-messages.mjs";

export type ApprovalActionState = {
  status: "idle" | "success" | "error";
  message: string | null;
  warning?: string | null;
  percentage?: string;
  universityId?: string;
};

function readStringField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

const PERCENTAGE_PATTERN = /^\d{1,3}([.,]\d{1,2})?$/;

function buildApprovalRedirect(params: Record<string, string>): never {
  const search = new URLSearchParams(params);
  redirect(`/approvals?${search.toString()}`);
}

export async function approveUniversityAction(
  _previousState: ApprovalActionState,
  formData: FormData,
): Promise<ApprovalActionState> {
  await requireSuperAdminAccess();

  const universityId = readStringField(formData, "universityId").trim();
  const rawPercentage = readStringField(formData, "percentage").trim();

  if (!universityId) {
    buildApprovalRedirect({
      status: "error",
      reason: "missing_id",
    });
  }

  if (!PERCENTAGE_PATTERN.test(rawPercentage)) {
    buildApprovalRedirect({
      status: "error",
      reason: "invalid_percentage",
    });
  }

  const parsedNumber = parseFloat(rawPercentage.replace(",", "."));
  if (Number.isNaN(parsedNumber) || parsedNumber < 0 || parsedNumber > 100) {
    buildApprovalRedirect({
      status: "error",
      reason: "invalid_percentage",
    });
  }

  const revenueShareBps = Math.round(parsedNumber * 100);

  const result = await approveUniversity({
    universityId,
    revenueShareBps,
  });

  if (!result.ok) {
    buildApprovalRedirect({
      status: "error",
      reason: result.reason,
    });
  }

  const recipientEmails = result.recipientEmails ?? [];
  let sentCount = 0;

  for (const recipient of recipientEmails) {
    try {
      await sendUniversityApprovedEmail(recipient, result.universityName);
      sentCount++;
    } catch {
      // Email sending failure
    }
  }

  const emailStatus = resolveApprovalEmailStatus(recipientEmails.length, sentCount);

  revalidatePath("/approvals");

  buildApprovalRedirect({
    status: "success",
    name: result.universityName,
    share: String(rawPercentage),
    emailStatus,
    recipients: String(sentCount),
  });
}
