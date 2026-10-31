import { eq } from "drizzle-orm";
import type { db as sharedDb } from "./client";
import * as schema from "./schema";
import { hashPassword, isPasswordValid, verifyPassword } from "./password";

type UniversityAdminLoginDatabase = typeof sharedDb;

async function resolveDatabase(
  database?: UniversityAdminLoginDatabase,
): Promise<UniversityAdminLoginDatabase> {
  return database ?? (await import("./client")).db;
}

export type AuthenticateUniversityAdminResult =
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

export async function authenticateUniversityAdmin(
  input: { email: unknown; password: unknown },
  database?: UniversityAdminLoginDatabase,
): Promise<AuthenticateUniversityAdminResult> {
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
    || user.role !== "university_admin"
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
