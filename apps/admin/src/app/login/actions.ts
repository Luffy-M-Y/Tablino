"use server";

import { getSessionCookieConfig } from "@tablino/auth";
import {
  authenticateUniversityAdmin,
  checkRateLimit,
  createStudentSession,
  recordFailure,
  resetAttempts,
} from "@tablino/db";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { startEmailVerification } from "@/lib/email-verification-flow";

export type LoginActionState = {
  message: string | null;
  email: string;
};

function readStringField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function loginAction(
  _previousState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const email = readStringField(formData, "email").trim().toLowerCase();
  const password = readStringField(formData, "password");
  const limit = await checkRateLimit("login", email);
  if (!limit.allowed) {
    return { message: "Trop de tentatives. Réessaie plus tard.", email };
  }

  const result = await authenticateUniversityAdmin({ email, password });
  if (!result.ok && result.reason === "email_not_verified") {
    await startEmailVerification(result.userId, email);
    redirect("/verify");
  }
  if (!result.ok) {
    await recordFailure("login", email);
    return { message: "Email ou mot de passe incorrect.", email };
  }

  await resetAttempts("login", email);

  const session = await createStudentSession(result.userId);
  const cookieConfig = getSessionCookieConfig("admin");
  const cookieStore = await cookies();
  cookieStore.set(cookieConfig.name, session.sessionToken, {
    ...cookieConfig.options,
    expires: session.expires,
  });
  redirect("/");
}
