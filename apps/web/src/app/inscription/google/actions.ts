"use server";

import { getCloudflareClientIp, getSessionCookieConfig, verifyGoogleSignupToken } from "@tablino/auth";
import {
  checkRateLimit,
  createStudentSession,
  recordFailure,
  registerGoogleStudentWithCode,
  resetAttempts,
} from "@tablino/db";
import { cookies, headers } from "next/headers";
import { TURNSTILE_ERROR_MESSAGE, verifyTurnstileForm } from "@/lib/turnstile";
import { getCurrentUniversityId } from "@/lib/university";

export type GoogleRegisterActionState = { message: string | null; redirectTo?: "/" };

function readStringField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function registerGoogleAction(
  _previousState: GoogleRegisterActionState,
  formData: FormData,
): Promise<GoogleRegisterActionState> {
  if (!(await verifyTurnstileForm(formData, "signup_google"))) {
    return { message: TURNSTILE_ERROR_MESSAGE };
  }

  const clientIp = getCloudflareClientIp(await headers());
  if (clientIp === null && process.env.NODE_ENV === "production") {
    return { message: "Inscription temporairement indisponible." };
  }
  if (clientIp !== null) {
    const ipLimit = await checkRateLimit("signup_ip", clientIp);
    if (!ipLimit.allowed) return { message: "Trop d'inscriptions depuis ce réseau. Réessaie plus tard." };
  }

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
  if (payload.universityId !== universityId) {
    return { message: "Lien expiré. Recommence avec Google." };
  }

  const limit = await checkRateLimit("signup_code", payload.email);
  if (!limit.allowed) return { message: "Trop de tentatives. Réessaie plus tard." };

  // Chaque tentative d'inscription vérifiée compte dans la limite par IP (10 par heure).
  if (clientIp !== null) await recordFailure("signup_ip", clientIp);

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
  return { message: null, redirectTo: "/" };
}
