"use server";

import { getSessionCookieConfig, verifyUniversitySignupToken } from "@tablino/auth";
import { createStudentSession, registerUniversityAdminWithGoogle } from "@tablino/db";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { parseAndValidateBurkinaPhone } from "@/lib/phone-countries";
import { notifySuperAdminOfPendingUniversity } from "@/lib/university-approval-alert";
import { TURNSTILE_ERROR_MESSAGE, verifyTurnstileForm } from "@/lib/turnstile";

export type UniversitySignupActionState = {
  message: string | null;
  universityName: string;
  acronym: string;
  phone: string;
  showForm: boolean;
  showLoginLink: boolean;
};

function readStringField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function registerUniversityAction(
  _previousState: UniversitySignupActionState,
  formData: FormData,
): Promise<UniversitySignupActionState> {
  const token = readStringField(formData, "token");
  const universityName = readStringField(formData, "universityName");
  const acronym = readStringField(formData, "acronym");
  const phone = readStringField(formData, "phone");
  const state = { universityName, acronym, phone };
  if (!(await verifyTurnstileForm(formData, "signup_google"))) {
    return {
      message: TURNSTILE_ERROR_MESSAGE,
      ...state,
      showForm: true,
      showLoginLink: false,
    };
  }

  let payload: ReturnType<typeof verifyUniversitySignupToken>;
  try {
    payload = token ? verifyUniversitySignupToken(token) : null;
  } catch {
    return {
      message: "La vérification du lien est indisponible. Recommencez depuis la connexion admin.",
      ...state,
      showForm: false,
      showLoginLink: true,
    };
  }

  if (payload === null) {
    return {
      message: "Ce lien d'inscription est absent, invalide ou expiré. Recommencez depuis la connexion admin.",
      ...state,
      showForm: false,
      showLoginLink: true,
    };
  }

  const trimmedAcronym = acronym.trim();
  if (!trimmedAcronym) {
    return {
      message: "L'acronyme de l'université est obligatoire.",
      ...state,
      showForm: true,
      showLoginLink: false,
    };
  }

  const phoneValidation = parseAndValidateBurkinaPhone(phone);
  if (!phoneValidation.ok || !phoneValidation.phone) {
    return {
      message: !phoneValidation.ok ? phoneValidation.error : "Le numéro de téléphone est obligatoire.",
      ...state,
      showForm: true,
      showLoginLink: false,
    };
  }

  const result = await registerUniversityAdminWithGoogle({
    universityName,
    email: payload.email,
    name: payload.name,
    image: payload.image,
    providerAccountId: payload.providerAccountId,
    acronym: trimmedAcronym,
    phone: phoneValidation.phone,
  });

  if (result.ok) {
    const session = await createStudentSession(result.userId);
    const sessionCookieConfig = getSessionCookieConfig("admin");
    const cookieStore = await cookies();
    cookieStore.set(sessionCookieConfig.name, session.sessionToken, {
      ...sessionCookieConfig.options,
      expires: session.expires,
    });
    await notifySuperAdminOfPendingUniversity(result.userId);
    redirect("/university-pending");
  }

  if (result.reason === "email_taken" || result.reason === "account_taken") {
    return {
      message: "Cette adresse ou ce compte Google est déjà utilisé. Connectez-vous avec votre compte existant.",
      ...state,
      showForm: false,
      showLoginLink: true,
    };
  }

  if (result.reason === "invalid_input") {
    return {
      message: "Vérifiez le nom de l'université, l'acronyme (20 caractères maximum) et le téléphone (32 caractères maximum).",
      ...state,
      showForm: true,
      showLoginLink: false,
    };
  }

  return {
    message: "La création de l'université est temporairement indisponible. Réessayez.",
    ...state,
    showForm: true,
    showLoginLink: false,
  };
}
