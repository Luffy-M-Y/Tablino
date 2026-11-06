"use server";

import {
  getPasswordResetConfirmedCookieConfig,
  getPasswordResetCookieConfig,
  verifyPasswordResetConfirmedToken,
} from "@tablino/auth";
import { setStudentPassword } from "@tablino/db";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUniversityId } from "@/lib/university";

export type NewPasswordActionState = { message: string | null };

function readStringField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

async function readConfirmedUserId(): Promise<string | null> {
  try {
    const cookieConfig = getPasswordResetConfirmedCookieConfig();
    const cookieStore = await cookies();
    const raw = cookieStore.get(cookieConfig.name)?.value ?? "";
    return raw ? verifyPasswordResetConfirmedToken(raw) : null;
  } catch {
    return null;
  }
}

export async function setNewPasswordAction(
  _previousState: NewPasswordActionState,
  formData: FormData,
): Promise<NewPasswordActionState> {
  await getCurrentUniversityId();
  const userId = await readConfirmedUserId();
  if (userId === null) {
    return { message: "Lien expiré. Demande un nouveau code." };
  }

  const password = readStringField(formData, "password");
  const passwordConfirmation = readStringField(formData, "passwordConfirmation");
  if (password !== passwordConfirmation) {
    return { message: "Les mots de passe ne correspondent pas." };
  }

  const result = await setStudentPassword(userId, password);
  if (!result.ok) {
    switch (result.reason) {
      case "invalid_input":
        return { message: "Le mot de passe doit contenir au moins 8 caractères." };
      case "not_found":
        return { message: "Lien expiré. Demande un nouveau code." };
      default:
        return { message: "Lien expiré. Demande un nouveau code." };
    }
  }

  const requestConfig = getPasswordResetCookieConfig();
  const confirmedConfig = getPasswordResetConfirmedCookieConfig();
  const cookieStore = await cookies();
  cookieStore.set(requestConfig.name, "", { ...requestConfig.options, maxAge: 0 });
  cookieStore.set(confirmedConfig.name, "", { ...confirmedConfig.options, maxAge: 0 });
  redirect("/connexion?reset=ok");
}
