"use server";

import { getSessionCookieConfig, verifyGoogleSignupToken } from "@tablino/auth";
import { createStudentSession, registerGoogleStudentWithCode } from "@tablino/db";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUniversityId } from "@/lib/university";

export type GoogleRegisterActionState = { message: string | null };

function readStringField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function registerGoogleAction(
  _previousState: GoogleRegisterActionState,
  formData: FormData,
): Promise<GoogleRegisterActionState> {
  const token = readStringField(formData, "token");
  const accessCode = readStringField(formData, "accessCode");
  let payload: ReturnType<typeof verifyGoogleSignupToken>;
  try {
    payload = verifyGoogleSignupToken(token);
  } catch {
    return { message: "Lien expiré. Recommence avec Google." };
  }
  if (payload === null) return { message: "Lien expiré. Recommence avec Google." };

  const result = await registerGoogleStudentWithCode(await getCurrentUniversityId(), {
    email: payload.email,
    name: payload.name,
    image: payload.image,
    providerAccountId: payload.providerAccountId,
    accessCode,
  });
  if (!result.ok) {
    switch (result.reason) {
      case "invalid_input":
        return { message: "Informations invalides." };
      case "invalid_code":
        return { message: "Code d'accès invalide ou expiré." };
      case "email_taken":
      case "account_taken":
        return { message: "Cette adresse est déjà utilisée." };
      default:
        return { message: "Informations invalides." };
    }
  }

  const session = await createStudentSession(result.userId);
  const cookieConfig = getSessionCookieConfig("web");
  const cookieStore = await cookies();
  cookieStore.set(cookieConfig.name, session.sessionToken, {
    ...cookieConfig.options,
    expires: session.expires,
  });
  redirect("/");
}
