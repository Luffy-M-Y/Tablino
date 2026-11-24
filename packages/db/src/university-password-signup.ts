import { sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import type { db as sharedDb } from "./client";
import * as schema from "./schema";
import { hashPassword, isPasswordValid } from "./password";
import { buildProgramSlug } from "./structure-validation";
import { findUniversityAddressConflict, normalizeUniversityAddress } from "./university-address";

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
      reason:
        | "invalid_input"
        | "email_taken"
        | "account_taken"
        | "slug_unavailable"
        | "locality_required"
        | "address_taken";
    };

const UNIVERSITY_SLUG_ATTEMPTS = 5;
const UNIVERSITY_SLUG_SUFFIX_LENGTH = 12;

function createProvisionalUniversitySlug(): string {
  return "u-" + randomBytes(UNIVERSITY_SLUG_SUFFIX_LENGTH / 2).toString("hex");
}

export async function registerUniversityAdminWithPassword(
  input: {
    universityName: string;
    acronym: string;
    locality?: string | null;
    visibility?: "private" | "public";
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
    || typeof input.acronym !== "string"
    || (input.locality !== undefined && input.locality !== null && typeof input.locality !== "string")
    || (input.visibility !== undefined && input.visibility !== "private" && input.visibility !== "public")
    || (input.phone !== null && typeof input.phone !== "string")
    || typeof input.email !== "string"
    || typeof input.name !== "string"
  ) {
    return { ok: false, reason: "invalid_input" };
  }

  const universityName = input.universityName.trim();
  const baseSlug = buildProgramSlug(universityName);
  const address = normalizeUniversityAddress(input.acronym, input.locality);
  const visibility = input.visibility ?? "private";
  const phone = input.phone?.trim() || null;
  const email = input.email.trim().toLowerCase();
  const separator = email.indexOf("@");
  const name = input.name.trim();
  if (
    universityName.length < 1
    || universityName.length > 255
    || baseSlug.length < 1
    || address === null
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

      const addressConflict = await findUniversityAddressConflict(tx, address);
      if (addressConflict !== null) return { ok: false, reason: addressConflict };

      let universityId: string | null = null;
      for (let attempt = 0; attempt < UNIVERSITY_SLUG_ATTEMPTS; attempt++) {
        const universities = await tx
          .insert(schema.universities)
          .values({
            name: universityName,
            slug: createProvisionalUniversitySlug(),
            acronym: address.acronym,
            locality: address.locality,
            visibility,
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
