import { and, eq, gt, isNull, lt, sql } from "drizzle-orm";
import type { db as sharedDb } from "./client";
import * as schema from "./schema";
import {
  hashAccessCode,
  isAccessCodeFormatValid,
  normalizeAccessCode,
} from "./access-codes";
import { hashPassword, isPasswordValid } from "./password";

type RegistrationDatabase = typeof sharedDb;

async function resolveDatabase(database?: RegistrationDatabase): Promise<RegistrationDatabase> {
  return database ?? (await import("./client")).db;
}

export type RegisterStudentResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "invalid_input" | "invalid_code" | "email_taken" };

export async function registerStudentWithCode(
  universityId: string,
  input: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    accessCode?: string;
  },
  database?: RegistrationDatabase,
  now = new Date(),
): Promise<RegisterStudentResult> {
  if (
    typeof input.firstName !== "string"
    || typeof input.lastName !== "string"
    || typeof input.email !== "string"
    || (input.accessCode !== undefined && typeof input.accessCode !== "string")
  ) {
    return { ok: false, reason: "invalid_input" };
  }

  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const email = input.email.trim().toLowerCase();
  const accessCode = input.accessCode?.trim() || "";
  const separator = email.indexOf("@");
  if (
    firstName.length < 1
    || firstName.length > 100
    || lastName.length < 1
    || lastName.length > 100
    || email.length < 3
    || email.length > 255
    || separator < 1
    || separator !== email.lastIndexOf("@")
    || separator === email.length - 1
    || !isPasswordValid(input.password)
    || (accessCode.length > 0 && !isAccessCodeFormatValid(normalizeAccessCode(accessCode)))
  ) {
    return { ok: false, reason: "invalid_input" };
  }

  try {
    return await (await resolveDatabase(database)).transaction(async (tx) => {
      const [university] = await tx
        .select({ visibility: schema.universities.visibility })
        .from(schema.universities)
        .where(eq(schema.universities.id, universityId))
        .limit(1);
      if (!university) return { ok: false, reason: "invalid_input" };

      const existingUsers = await tx
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(sql`lower(${schema.users.email}) = ${email}`)
        .limit(1);
      if (existingUsers.length > 0) return { ok: false, reason: "email_taken" };

      let accessCodeId: string | null = null;
      if (university.visibility !== "public") {
        if (accessCode.length === 0) return { ok: false, reason: "invalid_code" };

        const accessCodes = await tx
          .update(schema.accessCodes)
          .set({ usesCount: sql`uses_count + 1` })
          .where(and(
            eq(schema.accessCodes.codeHash, hashAccessCode(accessCode)),
            eq(schema.accessCodes.universityId, universityId),
            isNull(schema.accessCodes.revokedAt),
            gt(schema.accessCodes.expiresAt, now),
            lt(schema.accessCodes.usesCount, schema.accessCodes.maxUses),
          ))
          .returning({ id: schema.accessCodes.id });
        if (accessCodes.length === 0) return { ok: false, reason: "invalid_code" };
        accessCodeId = accessCodes[0].id;
      }

      const [user] = await tx
        .insert(schema.users)
        .values({
          name: firstName + " " + lastName,
          email,
          role: "student",
          universityId,
          accessCodeId,
          passwordHash: hashPassword(input.password),
        })
        .returning({ id: schema.users.id });

      if (!user) throw new Error("Échec de création du compte étudiant.");
      return { ok: true, userId: user.id };
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
