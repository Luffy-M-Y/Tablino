import { and, eq } from "drizzle-orm";
import type { db as sharedDb } from "./client";
import * as schema from "./schema";

type UniversityPartnershipDatabase = typeof sharedDb;

async function resolveDatabase(database?: UniversityPartnershipDatabase): Promise<UniversityPartnershipDatabase> {
  return database ?? (await import("./client")).db;
}

export type UniversityPartnershipInfo = {
  name: string;
  status: "pending" | "approved" | "active";
  revenueShareBps: number;
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
      status: schema.universities.status,
      revenueShareBps: schema.universities.revenueShareBps,
    })
    .from(schema.universities)
    .where(eq(schema.universities.id, universityId.trim()))
    .limit(1);

  return row ?? null;
}

export type CompleteUniversityPartnershipInput = {
  universityId: string;
  operator: string;
  holderName: string;
  numberEncrypted: string;
  contractVersion: string;
};

export type CompleteUniversityPartnershipResult =
  | { ok: true; acceptedShareBps: number }
  | { ok: false; reason: "invalid_input" | "not_approved" };

export async function completeUniversityPartnership(
  input: CompleteUniversityPartnershipInput,
  database?: UniversityPartnershipDatabase,
  now = new Date(),
): Promise<CompleteUniversityPartnershipResult> {
  if (
    typeof input !== "object"
    || input === null
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

  return dbInstance.transaction(async (tx) => {
    const updatedRows = await tx
      .update(schema.universities)
      .set({ status: "active" })
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

    return { ok: true, acceptedShareBps: updatedUniversity.revenueShareBps };
  });
}

