"use server";

import {
  createAdmin2faPendingToken,
  getAdmin2faPendingCookieConfig,
  getEmailVerificationCookieConfig,
  verifyEmailVerificationToken,
} from "@tablino/auth";
import {
  checkRateLimit,
  getStudentEmailById,
  issueEmailVerificationCode,
  recordFailure,
  resetAttempts,
  verifyEmailCode,
} from "@tablino/db";
import { sendVerificationEmail } from "@tablino/email";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminHostContext } from "@/lib/admin-host-context";
import { notifySuperAdminOfPendingUniversity } from "@/lib/university-approval-alert";
import { getUniversityAdminAccount, getUniversityAdminLoginUrl } from "@/lib/university-admin-account";
import { resolveUniversityAdminHost } from "@/lib/university-admin-host.mjs";
import { TURNSTILE_ERROR_MESSAGE, verifyTurnstileForm } from "@/lib/turnstile";

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
  if (!(await verifyTurnstileForm(formData, "email_verify"))) {
    return { message: TURNSTILE_ERROR_MESSAGE };
  }

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
  await notifySuperAdminOfPendingUniversity(userId);
  const verificationCookieConfig = getEmailVerificationCookieConfig();
  const cookieStore = await cookies();

  // Admin d'université vérifié hors de son hôte (hôte d'inscription) :
  // aucune session ici, connexion à faire sur l'hôte de son université.
  const account = await getUniversityAdminAccount(userId);
  if (account !== null && resolveUniversityAdminHost(account, await getAdminHostContext()) === "other_host") {
    const loginUrl = getUniversityAdminLoginUrl(account, {
      signupPending: account.universityStatus === "pending",
    });
    if (loginUrl !== null) {
      cookieStore.set(verificationCookieConfig.name, "", {
        ...verificationCookieConfig.options,
        maxAge: 0,
      });
      redirect(loginUrl);
    }
  }

  // 2FA obligatoire : aucune session avant le code (/login/2fa, jeton signé 5 min lié à l'hôte).
  const pendingCookieConfig = getAdmin2faPendingCookieConfig();
  cookieStore.set(
    pendingCookieConfig.name,
    createAdmin2faPendingToken(userId, (await headers()).get("host") ?? ""),
    pendingCookieConfig.options,
  );
  cookieStore.set(verificationCookieConfig.name, "", {
    ...verificationCookieConfig.options,
    maxAge: 0,
  });
  redirect("/login/2fa");
}

export async function resendCodeAction(
  _previousState: VerificationActionState,
  _formData: FormData,
): Promise<VerificationActionState> {
  if (!(await verifyTurnstileForm(_formData, "email_resend"))) {
    return { message: TURNSTILE_ERROR_MESSAGE };
  }

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
