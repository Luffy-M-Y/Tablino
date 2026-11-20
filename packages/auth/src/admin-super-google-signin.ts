export const AUTH_ADMIN_GOOGLE_ERROR_PATH = "/auth-admin/error";

export type AdminSuperGoogleUser = {
  role?: string | null;
  universityId?: string | null;
  revokedAt?: Date | string | number | null;
  emailVerified?: Date | string | number | null;
  passwordHash?: string | null;
  hasPassword?: boolean;
};

export function decideAdminSuperGoogleSignIn(options: {
  isAuthAdminCentral: boolean;
  user: AdminSuperGoogleUser | null;
}): boolean {
  const { isAuthAdminCentral, user } = options;

  if (!isAuthAdminCentral) return false;
  if (!user) return false;

  if (user.role !== "super_admin_editor" && user.role !== "super_admin_lector") {
    return false;
  }

  if (user.universityId !== null) return false;
  if (user.revokedAt !== null) return false;
  if (user.emailVerified === null || user.emailVerified === undefined) return false;

  const hasPassword =
    user.hasPassword === true
    || (typeof user.passwordHash === "string" && user.passwordHash.length > 0);
  if (!hasPassword) return false;

  return true;
}
