import "server-only";

import {
  AuthorizationDeniedError,
  type GuardUser,
  requireRole,
  requireSession,
  SessionRequiredError,
} from "@tablino/auth";
import { forbidden, redirect } from "next/navigation";
import { getAdminHostContext } from "./admin-host-context";
import { getHostDenialReason, isHostAllowedForUser } from "./host-access.mjs";
import { resolvePartnershipRoute } from "./partnership-routing.mjs";

/**
 * Vérifie le rôle ET l'hôte. Lance AuthorizationDeniedError si l'hôte
 * ne correspond pas — compatible avec tous les appelants qui catchent cette classe.
 * N'appelle ni redirect() ni forbidden() : destiné aux actions et route handlers.
 */
export async function requireRoleOnHost(
  allowedRoles: readonly ("super_admin" | "university_admin")[],
): Promise<GuardUser> {
  const user = await requireRole("admin", allowedRoles);
  const hostContext = await getAdminHostContext();
  const reason = getHostDenialReason(user, hostContext);
  if (reason !== null) {
    console.warn(JSON.stringify({ code: "admin_host_denied", reason }));
    throw new AuthorizationDeniedError();
  }
  return user;
}

export async function requireAdminAccess() {
  const user = await requireRoleWithHostCheck(["super_admin", "university_admin"]);
  return user;
}

export async function requireSuperAdminAccess() {
  const user = await requireRoleWithHostCheck(["super_admin"]);
  return user;
}

async function requireRoleWithHostCheck(allowedRoles: readonly ("super_admin" | "university_admin")[]) {
  let user: GuardUser;
  try {
    user = await requireRoleOnHost(allowedRoles);
  } catch (error) {
    if (error instanceof SessionRequiredError) redirect("/login");
    if (error instanceof AuthorizationDeniedError) forbidden();
    throw error;
  }
  return user;
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

  // Contrôle hôte via la logique pure partagée.
  if (user) {
    const hostContext = await getAdminHostContext();
    const reason = getHostDenialReason(user, hostContext);
    if (reason !== null) {
      console.warn(JSON.stringify({ code: "admin_host_denied", reason }));
      forbidden();
    }
  }

  const route = resolvePartnershipRoute({
    hasSession: Boolean(user),
    role: user?.role,
    status: user?.universityStatus,
  });

  switch (route) {
    case "signin":
      redirect("/login");
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
