import { eq } from "drizzle-orm";
import type { db as sharedDb } from "./client";
import * as schema from "./schema";

type GoogleLinkDatabase = typeof sharedDb;

async function resolveDatabase(database?: GoogleLinkDatabase): Promise<GoogleLinkDatabase> {
  return database ?? (await import("./client")).db;
}

export async function markGoogleEmailVerified(
  userId: string,
  now: Date,
  database?: GoogleLinkDatabase,
): Promise<{ found: boolean; passwordRemoved: boolean }> {
  return (await resolveDatabase(database)).transaction(async (tx) => {
    const users = await tx
      .select({
        id: schema.users.id,
        emailVerified: schema.users.emailVerified,
        passwordHash: schema.users.passwordHash,
      })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .for("update")
      .limit(1);
    if (!(users.length > 0)) return { found: false, passwordRemoved: false };

    const user = users[0];
    if (user.emailVerified !== null) return { found: true, passwordRemoved: false };

    await tx
      .update(schema.users)
      .set({ emailVerified: now, passwordHash: null })
      .where(eq(schema.users.id, userId));

    await tx
      .delete(schema.sessions)
      .where(eq(schema.sessions.userId, userId));

    return { found: true, passwordRemoved: user.passwordHash !== null };
  });
}
