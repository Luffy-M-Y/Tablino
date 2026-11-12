"use server";

import {
  authenticateStudent,
  checkRateLimit,
  createStudentSession,
  getStudentEmailById,
  recordFailure,
  resetAttempts,
} from "@tablino/db";
import { getCloudflareClientIp, getSessionCookieConfig } from "@tablino/auth";
import { cookies, headers } from "next/headers";
import { startEmailVerification } from "@/lib/email-verification-flow";
import { TURNSTILE_ERROR_MESSAGE, verifyTurnstileForm } from "@/lib/turnstile";
import { getCurrentUniversityId } from "@/lib/university";

export type LoginActionState = {
  message: string | null;
  redirectTo?: "/" | "/verification";
};

function readStringField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function loginAction(
  _previousState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const clientIp = getCloudflareClientIp(await headers());
  if (clientIp === null && process.env.NODE_ENV === "production") {
    return { message: "Connexion temporairement indisponible." };
  }
  if (clientIp !== null) {
    const ipLimit = await checkRateLimit("login_ip", clientIp);
    if (!ipLimit.allowed) return { message: "Trop de tentatives. Reessaie plus tard." };
  }

  if (!(await verifyTurnstileForm(formData, "login"))) {
    return { message: TURNSTILE_ERROR_MESSAGE };
  }

  const universityId = await getCurrentUniversityId();
  const email = readStringField(formData, "email");
  const password = readStringField(formData, "password");
  const limit = await checkRateLimit("login", email);
  if (!limit.allowed) return { message: "Trop de tentatives. Reessaie plus tard." };

  const result = await authenticateStudent(universityId, {
    email: email,
    password: password,
  });
  if (!result.ok && result.reason === "email_not_verified") {
    const verifiedEmail = await getStudentEmailById(result.userId);
    if (verifiedEmail !== null) {
      await startEmailVerification(result.userId, verifiedEmail);
    }
    return { message: null, redirectTo: "/verification" };
  }
  if (!result.ok) {
    await recordFailure("login", email);
    if (clientIp !== null) await recordFailure("login_ip", clientIp);
    return { message: "Email ou mot de passe incorrect." };
  }

  await resetAttempts("login", email);

  const session = await createStudentSession(result.userId);
  const cookieConfig = getSessionCookieConfig("web");
  const cookieStore = await cookies();
  cookieStore.set(cookieConfig.name, session.sessionToken, {
    ...cookieConfig.options,
    expires: session.expires,
  });
  return { message: null, redirectTo: "/" };
}
