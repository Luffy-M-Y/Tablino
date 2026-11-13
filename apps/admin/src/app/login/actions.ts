"use server";

import { getCloudflareClientIp, getSessionCookieConfig } from "@tablino/auth";
import {
  authenticateAdminPassword,
  checkRateLimit,
  createStudentSession,
  recordFailure,
  resetAttempts,
} from "@tablino/db";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminHostContext } from "@/lib/admin-host-context";
import { isAdminPasswordLoginAllowed } from "@/lib/admin-host.mjs";
import { startEmailVerification } from "@/lib/email-verification-flow";
import { TURNSTILE_ERROR_MESSAGE, verifyTurnstileForm } from "@/lib/turnstile";

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
  if (authenticatedRole === "super_admin") {
    const hostContext = await getAdminHostContext();
    if (!isAdminPasswordLoginAllowed(authenticatedRole, hostContext?.kind ?? null)) {
      await recordFailure("login", email);
      if (clientIp !== null) await recordFailure("login_ip", clientIp);
      return { message: "Email ou mot de passe incorrect.", email };
    }
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

  const session = await createStudentSession(result.userId);
  const cookieConfig = getSessionCookieConfig("admin");
  const cookieStore = await cookies();
  cookieStore.set(cookieConfig.name, session.sessionToken, {
    ...cookieConfig.options,
    expires: session.expires,
  });
  redirect("/");
}
