"use server";

import { getCloudflareClientIp } from "@tablino/auth";
import {
  checkRateLimit,
  consumeAdminInvitationCode,
  createAdminInvitationOauthStartTicket,
  recordFailure,
  resendAdminInvitationCode,
  startAdminInvitationAcceptance,
} from "@tablino/db";
import { sendAdminInvitationCodeEmail } from "@tablino/email";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminHostContext } from "@/lib/admin-host-context";
import {
  getAdminInvitationMessage,
  runAdminInvitationAcceptance,
  runStartAdminInvitationGoogle,
  ADMIN_INVITATION_COOKIE,
  ADMIN_INVITATION_PATH,
} from "@/lib/admin-invitation.mjs";
import { verifyTurnstileForm } from "@/lib/turnstile";

export type AcceptInvitationActionState = {
  message: string | null;
  status: "idle" | "success" | "error";
  step: "password" | "code";
};

function readStringField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

async function runAcceptanceStage(
  stage: "start" | "verify" | "resend",
  formData: FormData,
) {
  const hostContext = await getAdminHostContext();
  if (hostContext?.kind !== "super") {
    return {
      reason: "invitation_unavailable" as const,
      clearCookie: false,
      step: stage === "start" ? "password" as const : "code" as const,
    };
  }

  const action = ({
    start: "admin_invitation_start",
    verify: "admin_invitation_verify",
    resend: "admin_invitation_resend",
  } as const)[stage];
  if (!(await verifyTurnstileForm(formData, action))) {
    return {
      reason: "turnstile_failed" as const,
      clearCookie: false,
      step: stage === "start" ? "password" as const : "code" as const,
    };
  }

  const requestHeaders = await headers();
  const clientIp = getCloudflareClientIp(requestHeaders);
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_INVITATION_COOKIE)?.value;
  const outcome = await runAdminInvitationAcceptance({
    stage,
    token,
    password: readStringField(formData, "password"),
    passwordConfirmation: readStringField(formData, "passwordConfirmation"),
    code: readStringField(formData, "code"),
    clientIp,
    isProduction: process.env.NODE_ENV === "production",
    checkRateLimit,
    recordFailure,
    startAcceptance: startAdminInvitationAcceptance,
    resendCode: resendAdminInvitationCode,
    consumeCode: consumeAdminInvitationCode,
  });

  if (outcome.clearCookie) {
    cookieStore.delete({
      name: ADMIN_INVITATION_COOKIE,
      path: ADMIN_INVITATION_PATH,
    });
  }

  if (outcome.reason === "code_sent" || outcome.reason === "code_resent") {
    if (outcome.email === undefined || outcome.code === undefined) {
      throw new Error("Code d’invitation incomplet.");
    }
    try {
      await sendAdminInvitationCodeEmail(outcome.email, outcome.code);
    } catch {
      console.error(JSON.stringify({ code: "admin_invitation_code_email_failed" }));
      return {
        reason: "code_email_failed" as const,
        clearCookie: false,
        step: "code" as const,
      };
    }
  }

  return outcome;
}

function toState(
  reason: string,
  step: "password" | "code",
): AcceptInvitationActionState {
  const success = reason === "code_sent" || reason === "code_resent";
  return {
    status: success ? "success" : "error",
    message: getAdminInvitationMessage(reason),
    step,
  };
}

export async function startInvitationAcceptanceAction(
  _previousState: AcceptInvitationActionState,
  formData: FormData,
): Promise<AcceptInvitationActionState> {
  const outcome = await runAcceptanceStage("start", formData);
  return toState(outcome.reason, outcome.step);
}

export async function verifyInvitationCodeAction(
  _previousState: AcceptInvitationActionState,
  formData: FormData,
): Promise<AcceptInvitationActionState> {
  const outcome = await runAcceptanceStage("verify", formData);
  if (outcome.reason === "accepted") {
    redirect("/login");
  }
  return toState(outcome.reason, outcome.step);
}

export async function resendInvitationCodeAction(
  _previousState: AcceptInvitationActionState,
  formData: FormData,
): Promise<AcceptInvitationActionState> {
  const outcome = await runAcceptanceStage("resend", formData);
  return toState(outcome.reason, outcome.step);
}

export async function startAdminInvitationGoogleAction() {
  return runStartAdminInvitationGoogle({
    getHostContext: getAdminHostContext,
    getToken: async () => (await cookies()).get(ADMIN_INVITATION_COOKIE)?.value,
    createTicket: createAdminInvitationOauthStartTicket,
    getCentralHost: () => process.env.AUTH_ADMIN_CENTRAL_HOST,
    secure: process.env.NODE_ENV === "production",
  });
}
