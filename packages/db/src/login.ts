import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import type { db as sharedDb } from "./client";
import * as schema from "./schema";
import { hashPassword, isPasswordValid, verifyPassword } from "./password";

type LoginDatabase = typeof sharedDb;

async function resolveDatabase(database?: LoginDatabase): Promise<LoginDatabase> {
  return database ?? (await import("./client")).db;
}

export const SESSION_MAX_AGE_DAYS = 30;

export type AuthenticateStudentResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "invalid_credentials" }
  | { ok: false; reason: "email_not_verified"; userId: string };

let dummyPasswordHash: string | undefined;

function getDummyPasswordHash(): string {
  if (dummyPasswordHash === undefined) {
    dummyPasswordHash = hashPassword("tablino invalid login timing password");
  }
  return dummyPasswordHash;
}

export async function authenticateStudent(
  universityId: string,
  input: { email: unknown; password: unknown },
  database?: LoginDatabase,
): Promise<AuthenticateStudentResult> {
  if (
    typeof input !== "object"
    || input === null
    || typeof input.email !== "string"
    || typeof input.password !== "string"
  ) {
    return { ok: false, reason: "invalid_credentials" };
  }

  const email = input.email.trim().toLowerCase();
  const separator = email.indexOf("@");
  if (
    email.length < 3
    || email.length > 255
    || separator < 1
    || separator !== email.lastIndexOf("@")
    || separator === email.length - 1
    || !isPasswordValid(input.password)
  ) {
    return { ok: false, reason: "invalid_credentials" };
  }

  const [user] = await (await resolveDatabase(database))
    .select({
      id: schema.users.id,
      universityId: schema.users.universityId,
      role: schema.users.role,
      passwordHash: schema.users.passwordHash,
      revokedAt: schema.users.revokedAt,
      emailVerified: schema.users.emailVerified,
    })
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);

  const passwordHash = user?.passwordHash ?? getDummyPasswordHash();
  const passwordMatches = verifyPassword(input.password, passwordHash);
  if (
    !user
    || user.role !== "student"
    || user.universityId !== universityId
    || user.passwordHash === null
    || user.revokedAt !== null
    || !passwordMatches
  ) {
    return { ok: false, reason: "invalid_credentials" };
  }

  if (user.emailVerified === null) {
    return { ok: false, reason: "email_not_verified", userId: user.id };
  }

  return { ok: true, userId: user.id };
}

export async function getStudentEmailById(
  userId: string,
  database?: LoginDatabase,
): Promise<string | null> {
  const users = await (await resolveDatabase(database))
    .select({ email: schema.users.email })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  if (!(users.length > 0) || users[0].email === null) return null;
  return users[0].email;
}

export async function createStudentSession(
  userId: string,
  now = new Date(),
  database?: LoginDatabase,
): Promise<{ sessionToken: string; expires: Date }> {
  const sessionToken = randomBytes(32).toString("hex");
  const expires = new Date(now.getTime() + SESSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000);

  await (await resolveDatabase(database))
    .insert(schema.sessions)
    .values({ userId, sessionToken, expires });

  return { sessionToken, expires };
}
