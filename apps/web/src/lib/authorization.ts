import "server-only";

import {
  AuthorizationDeniedError,
  requireRole,
  requireUniversityAccess,
  SessionRequiredError,
  type GuardUser,
} from "@tablino/auth";
import { decideStudentAccess } from "@tablino/db";
import { forbidden, redirect } from "next/navigation";
import { getCurrentUniversityId } from "@/lib/university";

export async function requireStudentUniversityAccess(universityId: string) {
  let user: GuardUser;
  try {
    if (universityId !== await getCurrentUniversityId()) throw new AuthorizationDeniedError();
    const sessionUser = await requireRole("web", ["student"]);
    if (sessionUser.universityId !== universityId) throw new AuthorizationDeniedError();
    user = await requireUniversityAccess("web", universityId);
  } catch (error) {
    if (error instanceof SessionRequiredError) redirect("/api/auth/signin");
    if (error instanceof AuthorizationDeniedError) forbidden();
    throw error;
  }

  const decision = decideStudentAccess(user, new Date());
  if (decision === "revoked") forbidden();
  if (decision === "subscription_required") redirect("/choisir-acces");
  return user;
}
