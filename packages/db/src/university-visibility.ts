import { and, eq, isNull } from "drizzle-orm";
import type { db as sharedDb } from "./client";
import * as schema from "./schema";

type UniversityVisibilityDatabase = typeof sharedDb;

async function resolveDatabase(database?: UniversityVisibilityDatabase): Promise<UniversityVisibilityDatabase> {
  return database ?? (await import("./client")).db;
}

export type SetUniversityVisibilityResult =
  | { ok: true; visibility: "private" | "public"; revokedCodes: number }
  | { ok: false; reason: "invalid_input" | "not_authorized" | "not_active" };

export async function setUniversityVisibility(
  input: { userId: string; universityId: string; visibility: "private" | "public" },
  database?: UniversityVisibilityDatabase,
  now = new Date(),
): Promise<SetUniversityVisibilityResult> {
  if (
    typeof input !== "object"
    || input === null
    || typeof input.userId !== "string"
    || !input.userId.trim()
    || typeof input.universityId !== "string"
    || !input.universityId.trim()
    || (input.visibility !== "private" && input.visibility !== "public")
  ) {
    return { ok: false, reason: "invalid_input" };
  }

  const userId = input.userId.trim();
  const universityId = input.universityId.trim();
  const visibility = input.visibility;

  return (await resolveDatabase(database)).transaction(async (tx) => {
    const sessionUsers = await tx
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(and(
        eq(schema.users.id, userId),
        eq(schema.users.universityId, universityId),
        eq(schema.users.role, "university_admin"),
        isNull(schema.users.revokedAt),
      ))
      .limit(1);
    if (sessionUsers.length === 0) return { ok: false, reason: "not_authorized" };

    const universityRows = await tx
      .select({
        id: schema.universities.id,
        status: schema.universities.status,
        visibility: schema.universities.visibility,
      })
      .from(schema.universities)
      .where(eq(schema.universities.id, universityId))
      .for("update")
      .limit(1);
    const university = universityRows[0];
    if (!university || university.status !== "active") {
      return { ok: false, reason: "not_active" };
    }

    if (university.visibility === visibility) {
      return { ok: true, visibility, revokedCodes: 0 };
    }

    await tx
      .update(schema.universities)
      .set({ visibility })
      .where(eq(schema.universities.id, universityId));

    let revokedCodes = 0;
    if (visibility === "private") {
      const revoked = await tx
        .update(schema.accessCodes)
        .set({ revokedAt: now })
        .where(and(
          eq(schema.accessCodes.universityId, universityId),
          isNull(schema.accessCodes.revokedAt),
        ))
        .returning({ id: schema.accessCodes.id });
      revokedCodes = revoked.length;
    }

    return { ok: true, visibility, revokedCodes };
  });
}
