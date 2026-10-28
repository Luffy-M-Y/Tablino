"use server";

import {
  checkRateLimit,
  recordFailure,
  registerStudentWithCode,
  resetAttempts,
} from "@tablino/db";
import { redirect } from "next/navigation";
import { startEmailVerification } from "@/lib/email-verification-flow";
import { getCurrentUniversityId } from "@/lib/university";

export type RegisterActionState = { message: string | null };

function readStringField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function registerAction(
  _previousState: RegisterActionState,
  formData: FormData,
): Promise<RegisterActionState> {
  const universityId = await getCurrentUniversityId();
  const firstName = readStringField(formData, "firstName");
  const lastName = readStringField(formData, "lastName");
  const email = readStringField(formData, "email");
  const password = readStringField(formData, "password");
  const passwordConfirmation = readStringField(formData, "passwordConfirmation");
  const accessCode = readStringField(formData, "accessCode");

  if (password !== passwordConfirmation) {
    return { message: "Les mots de passe ne correspondent pas." };
  }

  const limit = await checkRateLimit("signup_code", email);
  if (!limit.allowed) return { message: "Trop de tentatives. Reessaie plus tard." };

  const result = await registerStudentWithCode(universityId, {
    firstName,
    lastName,
    email,
    password,
    accessCode,
  });
  if (!result.ok) {
    switch (result.reason) {
      case "invalid_input":
        return { message: "Informations invalides." };
      case "invalid_code":
        await recordFailure("signup_code", email);
        return { message: "Code d'accès invalide ou expiré." };
      case "email_taken":
        return { message: "Cette adresse est déjà utilisée." };
    }
  }

  await resetAttempts("signup_code", email);

  if (result.ok && result.userId) {
    await startEmailVerification(result.userId, email.trim().toLowerCase());
    redirect("/verification");
  }
  redirect("/connexion");
}
