"use server";

import {
  createPasswordResetConfirmedToken,
  getPasswordResetConfirmedCookieConfig,
  getPasswordResetCookieConfig,
  verifyPasswordResetToken,
} from "@tablino/auth";
import {
  checkRateLimit,
  recordFailure,
  resendPasswordResetCode,
  resetAttempts,
  verifyPasswordResetCode,
} from "@tablino/db";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sendPasswordResetEmail } from "@/lib/email";
import { TURNSTILE_ERROR_MESSAGE, verifyTurnstileForm } from "@/lib/turnstile";
import { getCurrentUniversityId } from "@/lib/university";

export type ResetVerificationActionState = { message: string | null };

function readStringField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

async function readUserId(): Promise<string | null> {
  try {
    const cookieConfig = getPasswordResetCookieConfig();
    const cookieStore = await cookies();
    const raw = cookieStore.get(cookieConfig.name)?.value ?? "";
    return raw ? verifyPasswordResetToken(raw) : null;
  } catch {
    return null;
  }
}

export async function verifyResetCodeAction(
  _previousState: ResetVerificationActionState,
  formData: FormData,
): Promise<ResetVerificationActionState> {
  if (!(await verifyTurnstileForm(formData, "password_reset_verify"))) {
    return { message: TURNSTILE_ERROR_MESSAGE };
  }

  await getCurrentUniversityId();
  const userId = await readUserId();
  if (userId === null) {
    return { message: "Lien expiré. Demande un nouveau code." };
  }

  const limit = await checkRateLimit("password_reset_verify", userId);
  if (!limit.allowed) return { message: "Trop de tentatives. Réessaie plus tard." };

  const result = await verifyPasswordResetCode(userId, readStringField(formData, "code"));
  if (!result.ok) {
    switch (result.reason) {
      case "invalid_input":
        return { message: "Code invalide." };
      case "invalid_code":
        await recordFailure("password_reset_verify", userId);
        return { message: "Code incorrect." };
      case "code_unavailable":
        return { message: "Code expiré. Demande un nouveau code." };
      default:
        return { message: "Code expiré. Demande un nouveau code." };
    }
  }

  await resetAttempts("password_reset_verify", userId);
  const confirmedConfig = getPasswordResetConfirmedCookieConfig();
  const cookieStore = await cookies();
  cookieStore.set(
    confirmedConfig.name,
    createPasswordResetConfirmedToken(userId),
    confirmedConfig.options,
  );
  redirect("/mot-de-passe-oublie/nouveau");
}

export async function resendResetCodeAction(
  _previousState: ResetVerificationActionState,
  _formData: FormData,
): Promise<ResetVerificationActionState> {
  if (!(await verifyTurnstileForm(_formData, "password_reset_resend"))) {
    return { message: TURNSTILE_ERROR_MESSAGE };
  }

  await getCurrentUniversityId();
  const userId = await readUserId();
  if (userId === null) {
    return { message: "Lien expiré. Demande un nouveau code." };
  }

  const verifyLimit = await checkRateLimit("password_reset_verify", userId);
  if (!verifyLimit.allowed) return { message: "Un nouveau code a été envoyé." };

  const result = await resendPasswordResetCode(userId);
  // Tous les échecs (compte inconnu, inéligible, délai, rate-limit) renvoient
  // le même message qu'un succès : ne pas révéler l'existence ni l'éligibilité.
  if (!result.ok) {
    return { message: "Un nouveau code a été envoyé." };
  }

  try {
    await sendPasswordResetEmail(result.email, result.code);
  } catch {
    console.error(JSON.stringify({ code: "password_reset_resend_email_failed" }));
  }

  return { message: "Un nouveau code a été envoyé." };
}
