import { eq } from "drizzle-orm";
import type { db as sharedDb } from "./client";
import * as schema from "./schema";

type SessionLogoutDatabase = typeof sharedDb;

async function resolveDatabase(database?: SessionLogoutDatabase): Promise<SessionLogoutDatabase> {
  return database ?? (await import("./client")).db;
}

export async function deleteStudentSession(
  sessionToken: string,
  database?: SessionLogoutDatabase,
): Promise<{ deleted: boolean }> {
  if (sessionToken === "" || sessionToken.length > 500) {
    return { deleted: false };
  }

  const deleted = await (await resolveDatabase(database))
    .delete(schema.sessions)
    .where(eq(schema.sessions.sessionToken, sessionToken))
    .returning({ id: schema.sessions.id });

  return { deleted: deleted.length > 0 };
}

export async function getStudentNameById(
  userId: string,
  database?: SessionLogoutDatabase,
): Promise<string | null> {
  const users = await (await resolveDatabase(database))
    .select({ name: schema.users.name })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);

  if (!(users.length > 0)) return null;
  const name = users[0].name;
  if (name === null) return null;
  const trimmed = name.trim();
  if (trimmed.length === 0) return null;
  return trimmed;
}
