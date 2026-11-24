import { getServerSession } from "next-auth/next";
import { createAuthOptions, getCurrentUniversityId } from "@tablino/auth";
import { getUniversityLogoUpdatedAt } from "@tablino/db";
import { getAvatarInitial, getRoleLabel } from "./admin-profile.mjs";
import { requireAdminAccess } from "./authorization";

export type AdminProfile = {
  email: string | null;
  name: string | null;
  roleLabel: string;
  initial: string;
  role: string;
  universityName: string | null;
  universityAcronym: string | null;
  universityLogoUrl: string | null;
};

export async function getAdminProfile(): Promise<AdminProfile> {
  const authorizedUser = await requireAdminAccess();
  const session = await getServerSession(createAuthOptions({
    surface: "admin",
    getCurrentUniversityId,
  }));

  const email = session?.user?.email ?? null;
  const name = session?.user?.name ?? null;
  // Logo servi par /universite/logo (hôte de l'université) ; version = date de mise à jour.
  let universityLogoUrl: string | null = null;
  if (authorizedUser.role === "university_admin" && authorizedUser.universityId) {
    try {
      const updatedAt = await getUniversityLogoUpdatedAt(authorizedUser.universityId);
      if (updatedAt) universityLogoUrl = `/universite/logo?v=${updatedAt.getTime()}`;
    } catch {
      universityLogoUrl = null;
    }
  }
  return {
    email,
    name,
    roleLabel: getRoleLabel(authorizedUser.role),
    initial: getAvatarInitial(session?.user?.name, email),
    role: authorizedUser.role,
    universityName: authorizedUser.universityName ?? null,
    universityAcronym: authorizedUser.universityAcronym ?? null,
    universityLogoUrl,
  };
}
