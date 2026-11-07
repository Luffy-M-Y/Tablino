"use server";

import { registerUniversityAdminWithPassword, checkRateLimit, resetAttempts } from "@tablino/db";
import { redirect } from "next/navigation";
import { startEmailVerification } from "@/lib/email-verification-flow";
import { parseAndValidateBurkinaPhone } from "@/lib/phone-countries";
import { TURNSTILE_ERROR_MESSAGE, verifyTurnstileForm } from "@/lib/turnstile";

export type SignupActionState = {
  message: string | null;
  universityName: string;
  acronym: string;
  phone: string;
  email: string;
};

function readStringField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function signupAction(
  _previousState: SignupActionState,
  formData: FormData,
): Promise<SignupActionState> {
  const universityName = readStringField(formData, "universityName");
  const acronym = readStringField(formData, "acronym");
  const phone = readStringField(formData, "phone");
  const email = readStringField(formData, "email").trim().toLowerCase();
  const password = readStringField(formData, "password");
  const passwordConfirmation = readStringField(formData, "passwordConfirmation");

  const state = { universityName, acronym, phone, email };
  if (!(await verifyTurnstileForm(formData, "signup"))) {
    return { ...state, message: TURNSTILE_ERROR_MESSAGE };
  }

  if (password !== passwordConfirmation) {
    return { ...state, message: "Les mots de passe ne correspondent pas." };
  }

  const trimmedAcronym = acronym.trim();
  if (!trimmedAcronym) {
    return { ...state, message: "L'acronyme de l'université est obligatoire." };
  }

  const phoneValidation = parseAndValidateBurkinaPhone(phone);
  if (!phoneValidation.ok || !phoneValidation.phone) {
    return {
      ...state,
      message: !phoneValidation.ok ? phoneValidation.error : "Le numéro de téléphone est obligatoire.",
    };
  }

  const limit = await checkRateLimit("signup_code", email);
  if (!limit.allowed) {
    return { ...state, message: "Trop de tentatives. Réessaie plus tard." };
  }

  const result = await registerUniversityAdminWithPassword({
    universityName,
    acronym: trimmedAcronym,
    phone: phoneValidation.phone,
    email,
    name: universityName,
    password,
  });
  if (!result.ok) {
    switch (result.reason) {
      case "invalid_input":
        return {
          ...state,
          message: "Informations invalides. Vérifiez le nom, l'acronyme, le téléphone, l'adresse e-mail et le mot de passe.",
        };
      case "email_taken":
        return { ...state, message: "Cette adresse est déjà utilisée." };
      case "account_taken":
        return { ...state, message: "Cette adresse ou ce compte est déjà utilisé." };
      case "slug_unavailable":
        return {
          ...state,
          message: "La création de l'université est temporairement indisponible. Réessayez.",
        };
    }
  }

  await resetAttempts("signup_code", email);
  await startEmailVerification(result.userId, email);
  redirect("/verify");
}
