import { and, eq, gt, isNull, lt, sql } from "drizzle-orm";
import type { db as sharedDb } from "./client";
import * as schema from "./schema";
import {
  hashAccessCode,
  isAccessCodeFormatValid,
  normalizeAccessCode,
} from "./access-codes";

type GoogleSignupDatabase = typeof sharedDb;

async function resolveDatabase(database?: GoogleSignupDatabase): Promise<GoogleSignupDatabase> {
  return database ?? (await import("./client")).db;
}

export type RegisterGoogleStudentResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "invalid_input" | "invalid_code" | "email_taken" | "account_taken" };

export async function registerGoogleStudentWithCode(
  universityId: string,
  input: {
    email: string;
    name: string | null;
    image: string | null;
    providerAccountId: string;
    accessCode: string;
  },
  database?: GoogleSignupDatabase,
  now = new Date(),
): Promise<RegisterGoogleStudentResult> {
  if (
    typeof input !== "object"
    || input === null
    || typeof input.email !== "string"
    || typeof input.providerAccountId !== "string"
    || typeof input.accessCode !== "string"
    || (input.name !== null && typeof input.name !== "string")
    || (input.image !== null && typeof input.image !== "string")
  ) {
    return { ok: false, reason: "invalid_input" };
  }

  const email = input.email.trim().toLowerCase();
  const separator = email.indexOf("@");
  const providerAccountId = input.providerAccountId.trim();
  const name = input.name?.trim() || null;
  const image = input.image?.trim() || null;
  if (
    email.length < 3
    || email.length > 255
    || separator < 1
    || separator !== email.lastIndexOf("@")
    || separator === email.length - 1
    || providerAccountId.length < 1
    || providerAccountId.length > 255
    || (name !== null && name.length > 255)
    || (image !== null && image.length > 500)
    || !isAccessCodeFormatValid(normalizeAccessCode(input.accessCode))
  ) {
    return { ok: false, reason: "invalid_input" };
  }

  try {
    return await (await resolveDatabase(database)).transaction(async (tx) => {
      const existingUsers = await tx
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(sql`lower(${schema.users.email}) = ${email}`)
        .limit(1);
      if (existingUsers.length > 0) return { ok: false, reason: "email_taken" };

      const existingAccounts = await tx
        .select({ userId: schema.accounts.userId })
        .from(schema.accounts)
        .where(and(
          eq(schema.accounts.provider, "google"),
          eq(schema.accounts.providerAccountId, providerAccountId),
        ))
        .limit(1);
      if (existingAccounts.length > 0) return { ok: false, reason: "account_taken" };

      const accessCodes = await tx
        .update(schema.accessCodes)
        .set({ usesCount: sql`uses_count + 1` })
        .where(and(
          eq(schema.accessCodes.codeHash, hashAccessCode(input.accessCode)),
          eq(schema.accessCodes.universityId, universityId),
          isNull(schema.accessCodes.revokedAt),
          gt(schema.accessCodes.expiresAt, now),
          lt(schema.accessCodes.usesCount, schema.accessCodes.maxUses),
        ))
        .returning({ id: schema.accessCodes.id });
      if (!(accessCodes.length > 0)) return { ok: false, reason: "invalid_code" };

      const users = await tx
        .insert(schema.users)
        .values({
          name,
          email,
          image,
          role: "student",
          universityId,
          accessCodeId: accessCodes[0].id,
          emailVerified: now,
        })
        .returning({ id: schema.users.id });
      if (!(users.length > 0)) throw new Error("Échec de création du compte étudiant Google.");

      await tx.insert(schema.accounts).values({
        userId: users[0].id,
        type: "oauth",
        provider: "google",
        providerAccountId,
      });

      return { ok: true, userId: users[0].id };
    });
  } catch (error) {
    if (
      typeof error === "object"
      && error !== null
      && "code" in error
      && error.code === "23505"
    ) {
      return { ok: false, reason: "email_taken" };
    }
    throw error;
  }
}
