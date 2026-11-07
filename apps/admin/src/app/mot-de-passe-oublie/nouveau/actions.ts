"use server";

import {
  getPasswordResetConfirmedCookieConfig,
  getPasswordResetCookieConfig,
  verifyAdminPasswordResetConfirmedToken,
} from "@tablino/auth";
import { setAdminPassword } from "@tablino/db";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { TURNSTILE_ERROR_MESSAGE, verifyTurnstileForm } from "@/lib/turnstile";

export type NewPasswordActionState = { message: string | null };

function readStringField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

async function readConfirmedAdminUserId(): Promise<string | null> {
  try {
    const config = getPasswordResetConfirmedCookieConfig("admin");
    const cookieStore = await cookies();
    const raw = cookieStore.get(config.name)?.value ?? "";
    return raw ? verifyAdminPasswordResetConfirmedToken(raw) : null;
  } catch {
    return null;
  }
}

export async function setNewPasswordAction(
  _previousState: NewPasswordActionState,
  formData: FormData,
): Promise<NewPasswordActionState> {
  if (!(await verifyTurnstileForm(formData, "password_reset_set"))) {
    return { message: TURNSTILE_ERROR_MESSAGE };
  }

  const userId = await readConfirmedAdminUserId();
  if (userId === null) {
    return { message: "Lien expiré. Demandez un nouveau code." };
  }

  const password = readStringField(formData, "password");
  const passwordConfirmation = readStringField(formData, "passwordConfirmation");
  if (password !== passwordConfirmation) {
    return { message: "Les mots de passe ne correspondent pas." };
  }

  const result = await setAdminPassword(userId, password);
  if (!result.ok) {
    switch (result.reason) {
      case "invalid_input":
        return { message: "Le mot de passe doit contenir au moins 8 caractères." };
      case "not_found":
        return { message: "Lien expiré. Demandez un nouveau code." };
    }
  }

  const requestConfig = getPasswordResetCookieConfig("admin");
  const confirmedConfig = getPasswordResetConfirmedCookieConfig("admin");
  const cookieStore = await cookies();
  cookieStore.set(requestConfig.name, "", { ...requestConfig.options, maxAge: 0 });
  cookieStore.set(confirmedConfig.name, "", { ...confirmedConfig.options, maxAge: 0 });
  redirect("/login?reset=ok");
}
