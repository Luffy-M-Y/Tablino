import "server-only";

import { AuthorizationDeniedError, requireRole, SessionRequiredError } from "@tablino/auth";
import { forbidden, redirect } from "next/navigation";

export async function requireAdminAccess() {
  try {
    return await requireRole("admin", ["super_admin", "university_admin"]);
  } catch (error) {
    if (error instanceof SessionRequiredError) redirect("/api/auth/signin");
    if (error instanceof AuthorizationDeniedError) forbidden();
    throw error;
  }
}
