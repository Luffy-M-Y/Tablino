import "server-only";

import {
  AuthorizationDeniedError,
  type GuardUser,
  requireRole,
  requireSession,
  SessionRequiredError,
} from "@tablino/auth";
import { forbidden, redirect } from "next/navigation";
import { resolvePartnershipRoute } from "./partnership-routing.mjs";

export async function requireAdminAccess() {
  try {
    return await requireRole("admin", ["super_admin", "university_admin"]);
  } catch (error) {
    if (error instanceof SessionRequiredError) redirect("/api/auth/signin");
    if (error instanceof AuthorizationDeniedError) forbidden();
    throw error;
  }
}

export async function requireSuperAdminAccess() {
  try {
    return await requireRole("admin", ["super_admin"]);
  } catch (error) {
    if (error instanceof SessionRequiredError) redirect("/api/auth/signin");
    if (error instanceof AuthorizationDeniedError) forbidden();
    throw error;
  }
}

export async function requireApprovedUniversityAdmin(): Promise<GuardUser & { universityId: string }> {
  let user: GuardUser | null = null;
  try {
    user = await requireSession("admin");
  } catch (error) {
    if (error instanceof SessionRequiredError) {
      user = null;
    } else if (error instanceof AuthorizationDeniedError) {
      forbidden();
    } else {
      throw error;
    }
  }

  const route = resolvePartnershipRoute({
    hasSession: Boolean(user),
    role: user?.role,
    status: user?.universityStatus,
  });

  switch (route) {
    case "signin":
      redirect("/api/auth/signin");
    case "pending":
      redirect("/university-pending");
    case "home":
      redirect("/");
    case "partnership":
      if (!user?.universityId) {
        forbidden();
      }
      return user as GuardUser & { universityId: string };
    case "forbidden":
    default:
      forbidden();
  }
}
