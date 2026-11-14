import {
  db,
  eq,
  getDashboardCounts,
  getSuperAdminDashboardData,
  getSuperAdminEditorDashboardData,
  getSuperAdminRevenue as fetchSuperAdminRevenue,
  schema,
} from "@tablino/db";
import {
  AuthorizationDeniedError,
  createAuthOptions,
  getCurrentUniversityId,
  requireUniversityAccess,
  SessionRequiredError,
} from "@tablino/auth";
import { getServerSession } from "next-auth/next";
import { forbidden, redirect } from "next/navigation";
import { getAdminHostContext } from "@/lib/admin-host-context";
import { requireRoleOnHost } from "@/lib/authorization";
import { isSuperAdminEditorDashboardAllowed } from "@/lib/editor-dashboard-access.mjs";

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

export async function getSuperAdminEditorDashboard() {
  const session = await getServerSession(createAuthOptions({
    surface: "admin",
    getCurrentUniversityId,
  }));
  if (!session?.user?.id) redirect("/login");

  const [user] = await db
    .select({
      role: schema.users.role,
      universityId: schema.users.universityId,
      revokedAt: schema.users.revokedAt,
    })
    .from(schema.users)
    .where(eq(schema.users.id, session.user.id))
    .limit(1);
  const hostContext = await getAdminHostContext();
  if (!user || !isSuperAdminEditorDashboardAllowed(user, hostContext)) forbidden();

  return getSuperAdminEditorDashboardData();
}
