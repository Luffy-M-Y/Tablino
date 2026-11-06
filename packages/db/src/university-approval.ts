import { and, asc, eq, isNotNull } from "drizzle-orm";
import type { db as sharedDb } from "./client";
import * as schema from "./schema";

type UniversityApprovalDatabase = typeof sharedDb;

async function resolveDatabase(database?: UniversityApprovalDatabase): Promise<UniversityApprovalDatabase> {
  return database ?? (await import("./client")).db;
}

export type PendingUniversityApprovalRow = {
  universityId: string;
  name: string;
  acronym: string | null;
  createdAt: Date;
  adminEmail: string;
  adminName: string | null;
};

export async function listPendingUniversitiesForApproval(
  database?: UniversityApprovalDatabase,
): Promise<PendingUniversityApprovalRow[]> {
  const dbInstance = await resolveDatabase(database);
  const rows = await dbInstance
    .select({
      universityId: schema.universities.id,
      name: schema.universities.name,
      acronym: schema.universities.acronym,
      createdAt: schema.universities.createdAt,
      adminEmail: schema.users.email,
      adminName: schema.users.name,
    })
    .from(schema.universities)
    .innerJoin(
      schema.users,
      and(
        eq(schema.users.universityId, schema.universities.id),
        eq(schema.users.role, "university_admin"),
        isNotNull(schema.users.emailVerified),
      ),
    )
    .where(eq(schema.universities.status, "pending"))
    .orderBy(asc(schema.universities.createdAt));

  const map = new Map<string, PendingUniversityApprovalRow>();
  for (const row of rows) {
    if (!map.has(row.universityId)) {
      map.set(row.universityId, row);
    }
  }
  return Array.from(map.values());
}

export type ApproveUniversityInput = {
  universityId: string;
  revenueShareBps: number;
};

export type ApproveUniversityResult =
  | { ok: true; universityName: string; recipientEmails: string[] }
  | { ok: false; reason: "invalid_input" | "not_found" | "not_pending" | "email_not_verified" };

export async function approveUniversity(
  input: ApproveUniversityInput,
  database?: UniversityApprovalDatabase,
  _now = new Date(),
): Promise<ApproveUniversityResult> {
  if (
    typeof input !== "object"
    || input === null
    || typeof input.universityId !== "string"
    || !input.universityId.trim()
    || typeof input.revenueShareBps !== "number"
    || !Number.isInteger(input.revenueShareBps)
    || input.revenueShareBps < 0
    || input.revenueShareBps > 10000
  ) {
    return { ok: false, reason: "invalid_input" };
  }

  const universityId = input.universityId.trim();
  const revenueShareBps = input.revenueShareBps;
  const dbInstance = await resolveDatabase(database);

  return await dbInstance.transaction(async (tx) => {
    const [university] = await tx
      .select({
        id: schema.universities.id,
        name: schema.universities.name,
        status: schema.universities.status,
      })
      .from(schema.universities)
      .where(eq(schema.universities.id, universityId))
      .limit(1);

    if (!university) {
      return { ok: false, reason: "not_found" };
    }

    if (university.status !== "pending") {
      return { ok: false, reason: "not_pending" };
    }

    const admins = await tx
      .select({
        email: schema.users.email,
      })
      .from(schema.users)
      .where(
        and(
          eq(schema.users.universityId, universityId),
          eq(schema.users.role, "university_admin"),
          isNotNull(schema.users.emailVerified),
        ),
      );

    if (admins.length === 0) {
      return { ok: false, reason: "email_not_verified" };
    }

    const recipientEmails = Array.from(
      new Set(
        admins
          .map((a) => a.email.trim().toLowerCase())
          .filter((e) => e.length > 0),
      ),
    );

    if (recipientEmails.length === 0) {
      return { ok: false, reason: "email_not_verified" };
    }

    const updated = await tx
      .update(schema.universities)
      .set({
        status: "approved",
        revenueShareBps,
      })
      .where(
        and(
          eq(schema.universities.id, universityId),
          eq(schema.universities.status, "pending"),
        ),
      )
      .returning({ id: schema.universities.id });

    if (updated.length === 0) {
      return { ok: false, reason: "not_pending" };
    }

    return {
      ok: true,
      universityName: university.name,
      recipientEmails,
    };
  });
}
