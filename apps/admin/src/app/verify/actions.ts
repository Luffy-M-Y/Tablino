"use server";

import {
  getEmailVerificationCookieConfig,
  getSessionCookieConfig,
  verifyEmailVerificationToken,
} from "@tablino/auth";
import {
  checkRateLimit,
  createStudentSession,
  getStudentEmailById,
  issueEmailVerificationCode,
  recordFailure,
  resetAttempts,
  verifyEmailCode,
} from "@tablino/db";
import { sendVerificationEmail } from "@tablino/email";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type VerificationActionState = { message: string | null };

function readStringField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

async function readUserId(): Promise<string | null> {
  try {
    const cookieConfig = getEmailVerificationCookieConfig();
    const cookieStore = await cookies();
    const raw = cookieStore.get(cookieConfig.name)?.value ?? "";
    return raw ? verifyEmailVerificationToken(raw) : null;
  } catch {
    return null;
  }
}

export async function verifyCodeAction(
  _previousState: VerificationActionState,
  formData: FormData,
): Promise<VerificationActionState> {
  const userId = await readUserId();
  if (userId === null) {
    return { message: "Lien expiré. Recommencez votre inscription ou connectez-vous." };
  }

  const limit = await checkRateLimit("verify_code", userId);
  if (!limit.allowed) return { message: "Trop de tentatives. Réessayez plus tard." };

  const result = await verifyEmailCode(userId, readStringField(formData, "code"));
  if (!result.ok) {
    switch (result.reason) {
      case "invalid_input":
        return { message: "Code invalide." };
      case "invalid_code":
        await recordFailure("verify_code", userId);
        return { message: "Code incorrect." };
      case "code_unavailable":
        return { message: "Code expiré. Demandez un nouveau code." };
    }
  }

  await resetAttempts("verify_code", userId);
  const session = await createStudentSession(userId);
  const sessionCookieConfig = getSessionCookieConfig("admin");
  const verificationCookieConfig = getEmailVerificationCookieConfig();
  const cookieStore = await cookies();
  cookieStore.set(sessionCookieConfig.name, session.sessionToken, {
    ...sessionCookieConfig.options,
    expires: session.expires,
  });
  cookieStore.set(verificationCookieConfig.name, "", {
    ...verificationCookieConfig.options,
    maxAge: 0,
  });
  redirect("/");
}

export async function resendCodeAction(
  _previousState: VerificationActionState,
  _formData: FormData,
): Promise<VerificationActionState> {
  const userId = await readUserId();
  if (userId === null) {
    return { message: "Lien expiré. Recommencez votre inscription ou connectez-vous." };
  }

  const verifyLimit = await checkRateLimit("verify_code", userId);
  if (!verifyLimit.allowed) return { message: "Trop de tentatives. Réessayez plus tard." };

  const limit = await checkRateLimit("email_send", userId);
  if (!limit.allowed) return { message: "Trop de demandes. Réessayez plus tard." };

  const issued = await issueEmailVerificationCode(userId);
  if (!issued.ok) {
    switch (issued.reason) {
      case "already_verified":
        redirect("/login");
      case "too_soon":
        return { message: "Patientez une minute avant de redemander." };
      case "not_found":
        return { message: "Lien expiré. Recommencez votre inscription ou connectez-vous." };
    }
  }

  await recordFailure("email_send", userId);

  const email = await getStudentEmailById(userId);
  if (email === null) {
    return { message: "Lien expiré. Recommencez votre inscription ou connectez-vous." };
  }

  try {
    await sendVerificationEmail(email, issued.code);
  } catch {
    return { message: "Envoi impossible pour le moment." };
  }

  return { message: "Un nouveau code a été envoyé." };
}
