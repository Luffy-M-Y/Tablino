"use server";

import { getCloudflareClientIp, getSessionCookieConfig } from "@tablino/auth";
import {
  authenticateAdminPassword,
  checkRateLimit,
  createAdminSuperLoginOauthStartTicket,
  createOauthStartTicket,
  createStudentSession,
  recordFailure,
  resetAttempts,
} from "@tablino/db";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminHostContext } from "@/lib/admin-host-context";
import { isAdminPasswordLoginAllowed } from "@/lib/admin-host.mjs";
import { runStartAdminGoogleSignIn } from "@/lib/auth-admin-google-start.mjs";
import { startEmailVerification } from "@/lib/email-verification-flow";
import { TURNSTILE_ERROR_MESSAGE, verifyTurnstileForm } from "@/lib/turnstile";
import { getUniversityAdminAccount, getUniversityAdminLoginUrl } from "@/lib/university-admin-account";
import { resolveUniversityAdminHost } from "@/lib/university-admin-host.mjs";

export type LoginActionState = {
  message: string | null;
  email: string;
};

function readStringField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function startAdminGoogleSignInAction() {
  return runStartAdminGoogleSignIn({
    getHostContext: getAdminHostContext,
    createTicket: (universityId, surface) => createOauthStartTicket(universityId, surface),
    createSuperLoginTicket: () => createAdminSuperLoginOauthStartTicket(),
    getCentralHost: () => process.env.AUTH_ADMIN_CENTRAL_HOST,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function loginAction(
  _previousState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const email = readStringField(formData, "email").trim().toLowerCase();
  const clientIp = getCloudflareClientIp(await headers());
  if (clientIp === null && process.env.NODE_ENV === "production") {
    return { message: "Connexion temporairement indisponible.", email };
  }
  if (clientIp !== null) {
    const ipLimit = await checkRateLimit("login_ip", clientIp);
    if (!ipLimit.allowed) {
      return { message: "Trop de tentatives. Réessaie plus tard.", email };
    }
  }

  if (!(await verifyTurnstileForm(formData, "login"))) {
    return { message: TURNSTILE_ERROR_MESSAGE, email };
  }

  const password = readStringField(formData, "password");
  const limit = await checkRateLimit("login", email);
  if (!limit.allowed) {
    return { message: "Trop de tentatives. Réessaie plus tard.", email };
  }

  const result = await authenticateAdminPassword({ email, password });
  const authenticatedRole = result.ok
    ? result.role
    : result.reason === "email_not_verified"
      ? result.role
      : null;
  const hostContext = await getAdminHostContext();
  if (!isAdminPasswordLoginAllowed(authenticatedRole, hostContext?.kind ?? null)) {
    await recordFailure("login", email);
    if (clientIp !== null) await recordFailure("login_ip", clientIp);
    return { message: "Email ou mot de passe incorrect.", email };
  }

  if (!result.ok && result.reason === "email_not_verified") {
    await startEmailVerification(result.userId, email);
    redirect("/verify");
  }

  if (!result.ok) {
    await recordFailure("login", email);
    if (clientIp !== null) await recordFailure("login_ip", clientIp);
    return { message: "Email ou mot de passe incorrect.", email };
  }

  await resetAttempts("login", email);

  // Admin d'université hors de son hôte : aucune session ici, connexion à
  // refaire sur l'hôte de son université (même règle que /verify).
  if (result.role === "university_admin") {
    const account = await getUniversityAdminAccount(result.userId);
    if (account !== null && resolveUniversityAdminHost(account, hostContext) === "other_host") {
      const loginUrl = getUniversityAdminLoginUrl(account);
      if (loginUrl !== null) redirect(loginUrl);
      return { message: "Connectez-vous depuis l'adresse d'administration de votre université.", email };
    }
  }

  const session = await createStudentSession(result.userId);
  const cookieConfig = getSessionCookieConfig("admin");
  const cookieStore = await cookies();
  cookieStore.set(cookieConfig.name, session.sessionToken, {
    ...cookieConfig.options,
    expires: session.expires,
  });
  redirect("/");
}
