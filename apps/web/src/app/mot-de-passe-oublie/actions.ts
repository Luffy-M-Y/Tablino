"use server";

import { redirect } from "next/navigation";
import { startPasswordReset } from "@/lib/password-reset-flow";
import { TURNSTILE_ERROR_MESSAGE, verifyTurnstileForm } from "@/lib/turnstile";
import { getCurrentUniversityId } from "@/lib/university";

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

  const universityId = await getCurrentUniversityId();
  const email = readStringField(formData, "email");
  await startPasswordReset(universityId, email);
  redirect("/mot-de-passe-oublie/verification");
}
