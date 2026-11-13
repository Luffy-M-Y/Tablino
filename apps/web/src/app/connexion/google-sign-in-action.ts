"use server";

import { createOauthStartTicket } from "@tablino/db";
import { runStartGoogleSignIn } from "@/lib/google-sign-in-start.mjs";
import { getCurrentUniversityId } from "@/lib/university";

export type { StartGoogleSignInResult } from "@/lib/google-sign-in-start.mjs";

/** Server Action publique : zéro argument, zéro entrée client. */
export async function startGoogleSignInAction() {
  return runStartGoogleSignIn({
    getUniversityId: getCurrentUniversityId,
    createTicket: (universityId) => createOauthStartTicket(universityId, "web"),
    getCentralHost: () => process.env.AUTH_CENTRAL_HOST,
    secure: process.env.NODE_ENV === "production",
  });
}
