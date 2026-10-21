import "server-only";

import {
  AuthorizationDeniedError,
  requireRole,
  requireUniversityAccess,
  SessionRequiredError,
} from "@tablino/auth";
import { forbidden, redirect } from "next/navigation";
import { getCurrentUniversityId } from "@/lib/university";

export async function requireStudentUniversityAccess(universityId: string) {
  try {
    if (universityId !== await getCurrentUniversityId()) throw new AuthorizationDeniedError();
    const user = await requireRole("web", ["student"]);
    if (user.universityId !== universityId) throw new AuthorizationDeniedError();
    return await requireUniversityAccess("web", universityId);
  } catch (error) {
    if (error instanceof SessionRequiredError) redirect("/api/auth/signin");
    if (error instanceof AuthorizationDeniedError) forbidden();
    throw error;
  }
}
