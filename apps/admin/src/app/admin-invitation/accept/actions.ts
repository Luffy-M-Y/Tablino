"use server";

import { getCloudflareClientIp } from "@tablino/auth";
import {
  checkRateLimit,
  consumeAdminInvitation,
  recordFailure,
} from "@tablino/db";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminHostContext } from "@/lib/admin-host-context";
import {
  getAdminInvitationCookieOptions,
  getAdminInvitationMessage,
  runAdminInvitationAcceptance,
  ADMIN_INVITATION_COOKIE,
  ADMIN_INVITATION_PATH,
} from "@/lib/admin-invitation.mjs";

export type AcceptInvitationActionState = {
  message: string | null;
  status: "idle" | "success" | "error";
};

function readStringField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function acceptInvitationAction(
  _previousState: AcceptInvitationActionState,
  formData: FormData,
): Promise<AcceptInvitationActionState> {
  const hostContext = await getAdminHostContext();
  if (hostContext?.kind !== "super") {
    return {
      status: "error",
      message: getAdminInvitationMessage("unavailable"),
    };
  }

  const requestHeaders = await headers();
  const clientIp = getCloudflareClientIp(requestHeaders);
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_INVITATION_COOKIE)?.value;

  const outcome = await runAdminInvitationAcceptance({
    token,
    password: readStringField(formData, "password"),
    passwordConfirmation: readStringField(formData, "passwordConfirmation"),
    clientIp,
    isProduction: process.env.NODE_ENV === "production",
    checkRateLimit,
    recordFailure,
    consumeInvitation: consumeAdminInvitation,
  });

  if (outcome.clearCookie) {
    cookieStore.set(
      ADMIN_INVITATION_COOKIE,
      "",
      {
        ...getAdminInvitationCookieOptions(
          process.env.NODE_ENV === "production",
        ),
        path: ADMIN_INVITATION_PATH,
        maxAge: 0,
      },
    );
  }

  if (outcome.reason === "accepted") {
    redirect("/login?invitation=accepted");
  }

  return {
    status: "error",
    message: getAdminInvitationMessage(outcome.reason),
  };
}
