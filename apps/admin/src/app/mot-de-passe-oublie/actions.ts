"use server";

import { redirect } from "next/navigation";
import { startAdminPasswordReset } from "@/lib/password-reset-flow";
import { TURNSTILE_ERROR_MESSAGE, verifyTurnstileForm } from "@/lib/turnstile";

export type RequestResetActionState = { message: string | null };

function readStringField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function requestResetAction(
  _previousState: RequestResetActionState,
  formData: FormData,
): Promise<RequestResetActionState> {
  if (!(await verifyTurnstileForm(formData, "password_reset_request"))) {
    return { message: TURNSTILE_ERROR_MESSAGE };
  }

  await startAdminPasswordReset(readStringField(formData, "email"));
  redirect("/mot-de-passe-oublie/verification");
}
