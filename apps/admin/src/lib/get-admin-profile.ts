import { getServerSession } from "next-auth/next";
import { createAuthOptions, getCurrentUniversityId } from "@tablino/auth";
import { getAvatarInitial, getRoleLabel } from "./admin-profile.mjs";
import { requireAdminAccess } from "./authorization";

export type AdminProfile = {
  email: string | null;
  roleLabel: string;
  initial: string;
};

export async function getAdminProfile(): Promise<AdminProfile> {
  const authorizedUser = await requireAdminAccess();
  const session = await getServerSession(createAuthOptions({
    surface: "admin",
    getCurrentUniversityId,
  }));

  const email = session?.user?.email ?? null;
  return {
    email,
    roleLabel: getRoleLabel(authorizedUser.role),
    initial: getAvatarInitial(session?.user?.name, email),
  };
}
