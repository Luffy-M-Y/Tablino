"use server";

import { getCloudflareClientIp, verifyUniversitySignupToken } from "@tablino/auth";
import { checkRateLimit, recordFailure, registerUniversityAdminWithGoogle } from "@tablino/db";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { parseAndValidateBurkinaPhone } from "@/lib/phone-countries";
import { getUniversityAdminAccount, getUniversityAdminLoginUrl } from "@/lib/university-admin-account";
import { notifySuperAdminOfPendingUniversity } from "@/lib/university-approval-alert";
import { TURNSTILE_ERROR_MESSAGE, verifyTurnstileForm } from "@/lib/turnstile";

export type UniversitySignupActionState = {
  message: string | null;
  universityName: string;
  acronym: string;
  locality: string;
  visibility: "private" | "public";
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
  const locality = readStringField(formData, "locality");
  const visibilityField = readStringField(formData, "visibility");
  const phone = readStringField(formData, "phone");
  const visibility: "private" | "public" = visibilityField === "public" ? "public" : "private";
  const state = { universityName, acronym, locality, visibility, phone };
  if (!(await verifyTurnstileForm(formData, "signup_google"))) {
    return {
      message: TURNSTILE_ERROR_MESSAGE,
      ...state,
      showForm: true,
      showLoginLink: false,
    };
  }

  const clientIp = getCloudflareClientIp(await headers());
  if (clientIp === null && process.env.NODE_ENV === "production") {
    return {
      message: "Inscription temporairement indisponible.",
      ...state,
      showForm: true,
      showLoginLink: false,
    };
  }
  if (clientIp !== null) {
    const ipLimit = await checkRateLimit("signup_ip", clientIp);
    if (!ipLimit.allowed) {
      return {
        message: "Trop d'inscriptions depuis ce réseau. Réessayez plus tard.",
        ...state,
        showForm: true,
        showLoginLink: false,
      };
    }
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

  if (visibilityField !== "private" && visibilityField !== "public") {
    return {
      message: "Choisissez la visibilité de l'université.",
      ...state,
      showForm: true,
      showLoginLink: false,
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

  // Chaque tentative d'inscription vérifiée compte dans la limite par IP (10 par heure).
  if (clientIp !== null) await recordFailure("signup_ip", clientIp);

  const result = await registerUniversityAdminWithGoogle({
    universityName,
    email: payload.email,
    name: payload.name,
    image: payload.image,
    providerAccountId: payload.providerAccountId,
    acronym: trimmedAcronym,
    locality: locality.trim() || null,
    visibility,
    phone: phoneValidation.phone,
  });

  if (result.ok) {
    await notifySuperAdminOfPendingUniversity(result.userId);
    // Aucune session ici : l'hôte courant n'est jamais celui de la nouvelle université.
    // La connexion se fait sur l'hôte d'administration de l'université.
    const account = await getUniversityAdminAccount(result.userId);
    const loginUrl = account === null ? null : getUniversityAdminLoginUrl(account, { signupPending: true });
    if (loginUrl !== null) redirect(loginUrl);
    return {
      message: "Université enregistrée. Connectez-vous depuis l'adresse d'administration de votre université.",
      ...state,
      showForm: false,
      showLoginLink: false,
    };
  }

  if (result.reason === "email_taken" || result.reason === "account_taken") {
    return {
      message: "Cette adresse ou ce compte Google est déjà utilisé. Connectez-vous avec votre compte existant.",
      ...state,
      showForm: false,
      showLoginLink: true,
    };
  }

  if (result.reason === "locality_required") {
    return {
      message: "Une université avec cet acronyme existe déjà. Précisez la localité.",
      ...state,
      showForm: true,
      showLoginLink: false,
    };
  }

  if (result.reason === "address_taken") {
    return {
      message: "Une université avec cet acronyme et cette localité existe déjà.",
      ...state,
      showForm: true,
      showLoginLink: false,
    };
  }

  if (result.reason === "invalid_input") {
    return {
      message: "Vérifiez le nom de l'université, l'acronyme (20 caractères maximum), la localité (60 caractères maximum) et le téléphone (32 caractères maximum).",
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
