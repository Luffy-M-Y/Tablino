"use server";

import { getSessionCookieConfig, verifyGoogleSignupToken } from "@tablino/auth";
import {
  checkRateLimit,
  createStudentSession,
  recordFailure,
  registerGoogleStudentWithCode,
  resetAttempts,
} from "@tablino/db";
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
  const universityId = await getCurrentUniversityId();
  const token = readStringField(formData, "token");
  const accessCode = readStringField(formData, "accessCode");
  let payload: ReturnType<typeof verifyGoogleSignupToken>;
  try {
    payload = verifyGoogleSignupToken(token);
  } catch {
    return { message: "Lien expiré. Recommence avec Google." };
  }
  if (payload === null) return { message: "Lien expiré. Recommence avec Google." };

  const limit = await checkRateLimit("signup_code", payload.email);
  if (!limit.allowed) return { message: "Trop de tentatives. Reessaie plus tard." };

  const result = await registerGoogleStudentWithCode(universityId, {
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
        await recordFailure("signup_code", payload.email);
        return { message: "Code d'accès invalide ou expiré." };
      case "email_taken":
      case "account_taken":
        return { message: "Cette adresse est déjà utilisée." };
      default:
        return { message: "Informations invalides." };
    }
  }

  await resetAttempts("signup_code", payload.email);

  const session = await createStudentSession(result.userId);
  const cookieConfig = getSessionCookieConfig("web");
  const cookieStore = await cookies();
  cookieStore.set(cookieConfig.name, session.sessionToken, {
    ...cookieConfig.options,
    expires: session.expires,
  });
  redirect("/");
}
