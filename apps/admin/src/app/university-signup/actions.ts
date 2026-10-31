"use server";

import { verifyUniversitySignupToken } from "@tablino/auth";
import { registerUniversityAdminWithGoogle } from "@tablino/db";
import { redirect } from "next/navigation";

export type UniversitySignupActionState = {
  message: string | null;
  universityName: string;
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
  let payload: ReturnType<typeof verifyUniversitySignupToken>;
  try {
    payload = token ? verifyUniversitySignupToken(token) : null;
  } catch {
    return {
      message: "La vérification du lien est indisponible. Recommencez depuis la connexion admin.",
      universityName,
      showForm: false,
      showLoginLink: true,
    };
  }

  if (payload === null) {
    return {
      message: "Ce lien d'inscription est absent, invalide ou expiré. Recommencez depuis la connexion admin.",
      universityName,
      showForm: false,
      showLoginLink: true,
    };
  }

  const result = await registerUniversityAdminWithGoogle({
    universityName,
    email: payload.email,
    name: payload.name,
    image: payload.image,
    providerAccountId: payload.providerAccountId,
  });

  if (result.ok) redirect("/api/auth/signin");

  if (result.reason === "email_taken" || result.reason === "account_taken") {
    return {
      message: "Cette adresse ou ce compte Google est déjà utilisé. Connectez-vous avec votre compte existant.",
      universityName,
      showForm: false,
      showLoginLink: true,
    };
  }

  if (result.reason === "invalid_input") {
    return {
      message: "Le nom de l'université doit contenir entre 1 et 255 caractères.",
      universityName,
      showForm: true,
      showLoginLink: false,
    };
  }

  return {
    message: "La création de l'université est temporairement indisponible. Réessayez.",
    universityName,
    showForm: true,
    showLoginLink: false,
  };
}
