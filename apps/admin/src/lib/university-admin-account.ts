import "server-only";

import { createAuthOptions, getCurrentUniversityId } from "@tablino/auth";
import { db, eq, schema } from "@tablino/db";
import { getServerSession } from "next-auth/next";
import { buildAdminLoginUrl } from "./admin-return-url.mjs";

export type UniversityAdminAccount = {
  role: string | null;
  universityId: string | null;
  revokedAt: Date | null;
  universityStatus: string | null;
  universitySlug: string | null;
};

export async function getUniversityAdminAccount(userId: string): Promise<UniversityAdminAccount | null> {
  const [account] = await db.select({
    role: schema.users.role,
    universityId: schema.users.universityId,
    revokedAt: schema.users.revokedAt,
    universityStatus: schema.universities.status,
    universitySlug: schema.universities.slug,
  })
    .from(schema.users)
    .leftJoin(schema.universities, eq(schema.users.universityId, schema.universities.id))
    .where(eq(schema.users.id, userId))
    .limit(1);

  return account ?? null;
}

export async function getCurrentUniversityAdminAccount(): Promise<UniversityAdminAccount | null> {
  const session = await getServerSession(createAuthOptions({
    surface: "admin",
    getCurrentUniversityId,
  }));
  const userId = session?.user?.id;
  if (!userId) return null;
  return getUniversityAdminAccount(userId);
}

/** URL de connexion sur l'hôte d'administration de l'université du compte. */
export function getUniversityAdminLoginUrl(account: UniversityAdminAccount): string | null {
  if (!account.universitySlug) return null;
  return buildAdminLoginUrl({
    slug: account.universitySlug,
    adminRootDomain: process.env.ADMIN_ROOT_DOMAIN ?? "",
    secure: process.env.NODE_ENV === "production",
  });
}
