"use server";

import { redirect } from "next/navigation";
import { getAdminHostContext } from "@/lib/admin-host-context";
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

  const hostContext = await getAdminHostContext();
  await startAdminPasswordReset(readStringField(formData, "email"), hostContext);
  redirect("/mot-de-passe-oublie/verification");
}
