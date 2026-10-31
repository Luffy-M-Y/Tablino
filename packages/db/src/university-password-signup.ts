import { sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import type { db as sharedDb } from "./client";
import * as schema from "./schema";
import { hashPassword, isPasswordValid } from "./password";
import { buildProgramSlug } from "./structure-validation";

type UniversityPasswordSignupDatabase = typeof sharedDb;

async function resolveDatabase(
  database?: UniversityPasswordSignupDatabase,
): Promise<UniversityPasswordSignupDatabase> {
  return database ?? (await import("./client")).db;
}

export type RegisterUniversityAdminWithPasswordResult =
  | { ok: true; universityId: string; userId: string }
  | {
      ok: false;
      reason: "invalid_input" | "email_taken" | "account_taken" | "slug_unavailable";
    };

const UNIVERSITY_SLUG_ATTEMPTS = 5;
const UNIVERSITY_SLUG_SUFFIX_LENGTH = 12;

function createUniversitySlug(base: string): string {
  const suffix = randomBytes(UNIVERSITY_SLUG_SUFFIX_LENGTH / 2).toString("hex");
  const maxBaseLength = 100 - suffix.length - 1;
  const truncatedBase = base.slice(0, maxBaseLength).replace(/-+$/g, "");
  return truncatedBase + "-" + suffix;
}

export async function registerUniversityAdminWithPassword(
  input: {
    universityName: string;
    acronym: string | null;
    phone: string | null;
    email: string;
    name: string;
    password: string;
  },
  database?: UniversityPasswordSignupDatabase,
  now = new Date(),
): Promise<RegisterUniversityAdminWithPasswordResult> {
  if (
    typeof input !== "object"
    || input === null
    || typeof input.universityName !== "string"
    || (input.acronym !== null && typeof input.acronym !== "string")
    || (input.phone !== null && typeof input.phone !== "string")
    || typeof input.email !== "string"
    || typeof input.name !== "string"
  ) {
    return { ok: false, reason: "invalid_input" };
  }

  const universityName = input.universityName.trim();
  const baseSlug = buildProgramSlug(universityName);
  const acronym = input.acronym?.trim() || null;
  const phone = input.phone?.trim() || null;
  const email = input.email.trim().toLowerCase();
  const separator = email.indexOf("@");
  const name = input.name.trim();
  if (
    universityName.length < 1
    || universityName.length > 255
    || baseSlug.length < 1
    || (acronym !== null && acronym.length > 20)
    || (phone !== null && phone.length > 32)
    || email.length < 3
    || email.length > 255
    || separator < 1
    || separator !== email.lastIndexOf("@")
    || separator === email.length - 1
    || name.length < 1
    || name.length > 255
    || !isPasswordValid(input.password)
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

      let universityId: string | null = null;
      for (let attempt = 0; attempt < UNIVERSITY_SLUG_ATTEMPTS; attempt++) {
        const universities = await tx
          .insert(schema.universities)
          .values({
            name: universityName,
            slug: createUniversitySlug(baseSlug),
            acronym,
            phone,
            status: "pending",
            revenueShareBps: 0,
          })
          .onConflictDoNothing({ target: schema.universities.slug })
          .returning({ id: schema.universities.id });
        if (universities.length > 0) {
          universityId = universities[0].id;
          break;
        }
      }
      if (universityId === null) return { ok: false, reason: "slug_unavailable" };

      const users = await tx
        .insert(schema.users)
        .values({
          name,
          email,
          role: "university_admin",
          universityId,
          passwordHash: hashPassword(input.password),
          emailVerified: null,
        })
        .returning({ id: schema.users.id });
      if (!(users.length > 0)) {
        throw new Error("Échec de création du compte administrateur d'université.");
      }

      return { ok: true, universityId, userId: users[0].id };
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
