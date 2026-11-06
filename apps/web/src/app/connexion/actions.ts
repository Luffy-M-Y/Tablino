"use server";

import {
  authenticateStudent,
  checkRateLimit,
  createStudentSession,
  getStudentEmailById,
  recordFailure,
  resetAttempts,
} from "@tablino/db";
import { getSessionCookieConfig } from "@tablino/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { startEmailVerification } from "@/lib/email-verification-flow";
import { getCurrentUniversityId } from "@/lib/university";

export type LoginActionState = { message: string | null };

function readStringField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function loginAction(
  _previousState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
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
    redirect("/verification");
  }
  if (!result.ok) {
    await recordFailure("login", email);
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
  redirect("/");
}
