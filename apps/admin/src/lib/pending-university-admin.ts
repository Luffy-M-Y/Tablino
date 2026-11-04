import "server-only";

import { createAuthOptions, getCurrentUniversityId } from "@tablino/auth";
import { db, eq, schema } from "@tablino/db";
import { getServerSession } from "next-auth/next";

export async function isCurrentUserPendingUniversityAdmin(): Promise<boolean | null> {
  const session = await getServerSession(createAuthOptions({
    surface: "admin",
    getCurrentUniversityId,
  }));
  const userId = session?.user?.id;
  if (!userId) return null;

  const [user] = await db.select({
    role: schema.users.role,
    universityStatus: schema.universities.status,
  })
    .from(schema.users)
    .leftJoin(schema.universities, eq(schema.users.universityId, schema.universities.id))
    .where(eq(schema.users.id, userId))
    .limit(1);

  return user?.role === "university_admin" && user.universityStatus === "pending";
}
