import { getDashboardCounts } from "@tablino/db";
import {
  AuthorizationDeniedError,
  requireRole,
  requireUniversityAccess,
  SessionRequiredError,
} from "@tablino/auth";
import { forbidden, redirect } from "next/navigation";

function handleGuardError(error: unknown): never {
  if (error instanceof SessionRequiredError) redirect("/api/auth/signin");
  if (error instanceof AuthorizationDeniedError) forbidden();
  throw error;
}

export async function getDashboardCountsForUniversity(universityId: string) {
  try {
    await requireRole("admin", ["super_admin", "university_admin"]);
    await requireUniversityAccess("admin", universityId);
  } catch (error) {
    return handleGuardError(error);
  }

  return getDashboardCounts(universityId);
}
