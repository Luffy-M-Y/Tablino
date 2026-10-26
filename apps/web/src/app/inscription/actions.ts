"use server";

import { getSessionCookieConfig } from "@tablino/auth";
import { registerStudentWithCode, createStudentSession } from "@tablino/db";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
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
  const firstName = readStringField(formData, "firstName");
  const lastName = readStringField(formData, "lastName");
  const email = readStringField(formData, "email");
  const password = readStringField(formData, "password");
  const passwordConfirmation = readStringField(formData, "passwordConfirmation");
  const accessCode = readStringField(formData, "accessCode");

  if (password !== passwordConfirmation) {
    return { message: "Les mots de passe ne correspondent pas." };
  }

  const result = await registerStudentWithCode(await getCurrentUniversityId(), {
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
        return { message: "Code d'accès invalide ou expiré." };
      case "email_taken":
        return { message: "Cette adresse est déjà utilisée." };
    }
  }

  if (result.ok && result.userId) {
    const session = await createStudentSession(result.userId);
    const cookieConfig = getSessionCookieConfig("web");
    const cookieStore = await cookies();
    cookieStore.set(cookieConfig.name, session.sessionToken, {
      ...cookieConfig.options,
      expires: session.expires,
    });
    redirect("/");
  }
  redirect("/connexion");
}
