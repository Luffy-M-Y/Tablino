import type { AuthRole } from "./roles";

export const AUTH_ADMIN_GOOGLE_ERROR_PATH = "/auth-admin/error";
export const AUTH_ADMIN_GOOGLE_EXISTING_ACCOUNT = "existing_account";

type AdminGoogleUser = {
  role: AuthRole;
  universityId: string | null;
};

export function decideAdminGoogleSignIn(options: {
  isAuthAdminCentral: boolean;
  user: AdminGoogleUser | null;
  googleUniversityId: string | null;
  hasGoogleAccountLinked?: boolean;
}): boolean | string | null {
  const { isAuthAdminCentral, user, googleUniversityId } = options;

  if (isAuthAdminCentral) {
    if (
      !user
      || user.role !== "university_admin"
      || user.universityId === null
      || user.universityId !== googleUniversityId
    ) {
      return AUTH_ADMIN_GOOGLE_ERROR_PATH;
    }
    return options.hasGoogleAccountLinked
      ? true
      : AUTH_ADMIN_GOOGLE_EXISTING_ACCOUNT;
  }

  if (!user) return null;
  if (user.role === "super_admin") return user.universityId === null;
  return user.role === "university_admin" && user.universityId !== null;
}

export function isAdminCentralGoogleLinkAllowed(isAuthAdminCentral: boolean): boolean {
  return !isAuthAdminCentral;
}

export function shouldMarkGoogleEmailVerified(surface: "admin" | "web") {
  return surface === "web";
}
