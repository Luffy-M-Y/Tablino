import {
  getDashboardCounts,
  getSuperAdminDashboardData,
  getSuperAdminRevenue as fetchSuperAdminRevenue,
} from "@tablino/db";
import {
  AuthorizationDeniedError,
  requireUniversityAccess,
  SessionRequiredError,
} from "@tablino/auth";
import { forbidden, redirect } from "next/navigation";
import { requireRoleOnHost } from "@/lib/authorization";

function handleGuardError(error: unknown): never {
  if (error instanceof SessionRequiredError) redirect("/api/auth/signin");
  if (error instanceof AuthorizationDeniedError) forbidden();
  throw error;
}

export async function getDashboardCountsForUniversity(universityId: string) {
  try {
    await requireRoleOnHost(["super_admin", "university_admin"]);
    await requireUniversityAccess("admin", universityId);
  } catch (error) {
    return handleGuardError(error);
  }

  return getDashboardCounts(universityId);
}

export async function getSuperAdminDashboard() {
  try {
    await requireRoleOnHost(["super_admin"]);
  } catch (error) {
    return handleGuardError(error);
  }

  return getSuperAdminDashboardData();
}

export async function getSuperAdminRevenue() {
  try {
    await requireRoleOnHost(["super_admin"]);
  } catch (error) {
    return handleGuardError(error);
  }

  return fetchSuperAdminRevenue();
}
