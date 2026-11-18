"use server";

import {
  createAdminPasswordResetConfirmedToken,
  getPasswordResetConfirmedCookieConfig,
} from "@tablino/auth";
import {
  checkRateLimit,
  recordFailure,
  resendAdminPasswordResetCode,
  resetAttempts,
  verifyAdminPasswordResetCode,
} from "@tablino/db";
import { sendPasswordResetEmail } from "@tablino/email";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminHostContext } from "@/lib/admin-host-context";
import { readAdminResetUserId } from "@/lib/password-reset-flow";
import { TURNSTILE_ERROR_MESSAGE, verifyTurnstileForm } from "@/lib/turnstile";

export type ResetVerificationActionState = { message: string | null };

function readStringField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function verifyResetCodeAction(
  _previousState: ResetVerificationActionState,
  formData: FormData,
): Promise<ResetVerificationActionState> {
  if (!(await verifyTurnstileForm(formData, "password_reset_verify"))) {
    return { message: TURNSTILE_ERROR_MESSAGE };
  }

  const userId = await readAdminResetUserId();
  if (userId === null) {
    return { message: "Lien expiré. Demandez un nouveau code." };
  }

  const limit = await checkRateLimit("password_reset_verify", userId);
  if (!limit.allowed) return { message: "Trop de tentatives. Réessayez plus tard." };

  const hostContext = await getAdminHostContext();
  const result = await verifyAdminPasswordResetCode(
    userId,
    readStringField(formData, "code"),
    hostContext,
  );
  if (!result.ok) {
    switch (result.reason) {
      case "invalid_input":
        return { message: "Code invalide." };
      case "invalid_code":
        await recordFailure("password_reset_verify", userId);
        return { message: "Code incorrect." };
      case "code_unavailable":
        return { message: "Code expiré. Demandez un nouveau code." };
    }
  }

  await resetAttempts("password_reset_verify", userId);
  const config = getPasswordResetConfirmedCookieConfig("admin");
  const cookieStore = await cookies();
  cookieStore.set(
    config.name,
    createAdminPasswordResetConfirmedToken(userId),
    config.options,
  );
  redirect("/mot-de-passe-oublie/nouveau");
}

export async function resendResetCodeAction(
  _previousState: ResetVerificationActionState,
  formData: FormData,
): Promise<ResetVerificationActionState> {
  if (!(await verifyTurnstileForm(formData, "password_reset_resend"))) {
    return { message: TURNSTILE_ERROR_MESSAGE };
  }

  const userId = await readAdminResetUserId();
  if (userId === null) {
    return { message: "Si le compte est admissible, un nouveau code a été envoyé." };
  }

  const verifyLimit = await checkRateLimit("password_reset_verify", userId);
  if (!verifyLimit.allowed) {
    return { message: "Si le compte est admissible, un nouveau code a été envoyé." };
  }

  const hostContext = await getAdminHostContext();
  const result = await resendAdminPasswordResetCode(userId, hostContext);
  if (result.ok) {
    try {
      await sendPasswordResetEmail(result.email, result.code);
    } catch {
      console.error(JSON.stringify({ code: "admin_password_reset_resend_email_failed" }));
    }
  }

  return { message: "Si le compte est admissible, un nouveau code a été envoyé." };
}
