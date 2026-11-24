import { and, eq, ne } from "drizzle-orm";
import type { db as sharedDb } from "./client";
import * as schema from "./schema";
import { normalizeUniversityAddress } from "./university-address";

type UniversityPartnershipDatabase = typeof sharedDb;

async function resolveDatabase(database?: UniversityPartnershipDatabase): Promise<UniversityPartnershipDatabase> {
  return database ?? (await import("./client")).db;
}

export type UniversityPartnershipInfo = {
  name: string;
  acronym: string | null;
  status: "pending" | "approved" | "active";
  revenueShareBps: number;
  locality: string | null;
  visibility: "private" | "public";
};

export async function getUniversityPartnershipInfo(
  universityId: string,
  database?: UniversityPartnershipDatabase,
): Promise<UniversityPartnershipInfo | null> {
  if (typeof universityId !== "string" || !universityId.trim()) {
    return null;
  }

  const dbInstance = await resolveDatabase(database);
  const [row] = await dbInstance
    .select({
      name: schema.universities.name,
      acronym: schema.universities.acronym,
      status: schema.universities.status,
      revenueShareBps: schema.universities.revenueShareBps,
      locality: schema.universities.locality,
      visibility: schema.universities.visibility,
    })
    .from(schema.universities)
    .where(eq(schema.universities.id, universityId.trim()))
    .limit(1);

  return row ?? null;
}

export type CompleteUniversityPartnershipInput = {
  userId: string;
  universityId: string;
  operator: string;
  holderName: string;
  numberEncrypted: string;
  contractVersion: string;
};

export type CompleteUniversityPartnershipResult =
  | { ok: true; acceptedShareBps: number; slug: string }
  | {
    ok: false;
    reason: "invalid_input" | "invalid_address" | "not_authorized" | "not_approved" | "slug_taken" | "already_completed";
  };

export async function completeUniversityPartnership(
  input: CompleteUniversityPartnershipInput,
  database?: UniversityPartnershipDatabase,
  now = new Date(),
): Promise<CompleteUniversityPartnershipResult> {
  if (
    typeof input !== "object"
    || input === null
    || typeof input.userId !== "string"
    || !input.userId.trim()
    || typeof input.universityId !== "string"
    || !input.universityId.trim()
    || typeof input.operator !== "string"
    || !input.operator.trim()
    || typeof input.holderName !== "string"
    || !input.holderName.trim()
    || typeof input.numberEncrypted !== "string"
    || !input.numberEncrypted.trim()
    || typeof input.contractVersion !== "string"
    || !input.contractVersion.trim()
  ) {
    return { ok: false, reason: "invalid_input" };
  }

  const dbInstance = await resolveDatabase(database);

  try {
    return await dbInstance.transaction(async (tx) => {
      const sessionUsers = await tx
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(and(
          eq(schema.users.id, input.userId.trim()),
          eq(schema.users.universityId, input.universityId.trim()),
          eq(schema.users.role, "university_admin"),
        ))
        .limit(1);
      if (sessionUsers.length === 0) {
        return { ok: false, reason: "not_authorized" };
      }

      const universityRows = await tx
        .select({
          id: schema.universities.id,
          status: schema.universities.status,
          revenueShareBps: schema.universities.revenueShareBps,
          acronym: schema.universities.acronym,
          locality: schema.universities.locality,
        })
        .from(schema.universities)
        .where(eq(schema.universities.id, input.universityId.trim()))
        .for("update")
        .limit(1);
      const university = universityRows[0];
      if (!university || university.status !== "approved") {
        return { ok: false, reason: "not_approved" };
      }

      const acceptedContracts = await tx
        .select({ contractAcceptedAt: schema.universityPayoutDetails.contractAcceptedAt })
        .from(schema.universityPayoutDetails)
        .where(eq(schema.universityPayoutDetails.universityId, input.universityId.trim()))
        .limit(1);
      if (acceptedContracts.length > 0) {
        return { ok: false, reason: "already_completed" };
      }

      // Adresse finale tirée des valeurs enregistrées à l'inscription.
      const address = normalizeUniversityAddress(university.acronym, university.locality);
      if (address === null) {
        return { ok: false, reason: "invalid_address" };
      }

      const slugCollisions = await tx
        .select({ id: schema.universities.id })
        .from(schema.universities)
        .where(and(
          eq(schema.universities.slug, address.slug),
          ne(schema.universities.id, input.universityId.trim()),
        ))
        .limit(1);
      if (slugCollisions.length > 0) {
        return { ok: false, reason: "slug_taken" };
      }

      const updatedRows = await tx
        .update(schema.universities)
        .set({
          slug: address.slug,
          status: "active",
        })
        .where(
          and(
            eq(schema.universities.id, input.universityId.trim()),
            eq(schema.universities.status, "approved"),
          ),
        )
        .returning({ revenueShareBps: schema.universities.revenueShareBps });
      const updatedUniversity = updatedRows[0];
      if (!updatedUniversity) {
        return { ok: false, reason: "not_approved" };
      }

      await tx
        .insert(schema.universityPayoutDetails)
        .values({
          universityId: input.universityId.trim(),
          mobileMoneyOperator: input.operator.trim(),
          mobileMoneyHolderName: input.holderName.trim(),
          mobileMoneyNumberEncrypted: input.numberEncrypted.trim(),
          contractVersion: input.contractVersion.trim(),
          contractAcceptedAt: now,
          acceptedShareBps: updatedUniversity.revenueShareBps,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: schema.universityPayoutDetails.universityId,
          set: {
            mobileMoneyOperator: input.operator.trim(),
            mobileMoneyHolderName: input.holderName.trim(),
            mobileMoneyNumberEncrypted: input.numberEncrypted.trim(),
            contractVersion: input.contractVersion.trim(),
            contractAcceptedAt: now,
            acceptedShareBps: updatedUniversity.revenueShareBps,
            updatedAt: now,
          },
        });

      return { ok: true, acceptedShareBps: updatedUniversity.revenueShareBps, slug: address.slug };
    });
  } catch (error) {
    if (
      typeof error === "object"
      && error !== null
      && "code" in error
      && error.code === "23505"
      && "constraint" in error
      && error.constraint === "universities_slug_unique"
    ) {
      return { ok: false, reason: "slug_taken" };
    }
    throw error;
  }
}
