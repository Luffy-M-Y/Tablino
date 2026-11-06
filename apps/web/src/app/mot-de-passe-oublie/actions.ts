"use server";

import { redirect } from "next/navigation";
import { startPasswordReset } from "@/lib/password-reset-flow";
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
  const universityId = await getCurrentUniversityId();
  const email = readStringField(formData, "email");
  await startPasswordReset(universityId, email);
  redirect("/mot-de-passe-oublie/verification");
}
