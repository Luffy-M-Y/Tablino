import { createHash, randomInt } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import type { db as sharedDb } from "./client";
import * as schema from "./schema";

export const ACCESS_CODE_TTL_HOURS = 24;
export const ACCESS_CODE_LENGTH = 12;
export const ACCESS_CODE_MAX_USES_LIMIT = 5000;
export const ACCESS_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

type AccessCodeDatabase = typeof sharedDb;

async function resolveDatabase(database?: AccessCodeDatabase): Promise<AccessCodeDatabase> {
  return database ?? (await import("./client")).db;
}

export type AccessCodeStatus = "usable" | "revoked" | "expired" | "exhausted";
export type CreateAccessCodeResult =
  | { ok: true; id: string; code: string; expiresAt: Date; maxUses: number }
  | { ok: false; reason: "invalid_max_uses" | "code_generation_failed" };
export type RevokeAccessCodeResult = { ok: true } | { ok: false; reason: "not_found" };

export function generateAccessCode(): string {
  let code = "";

  for (let index = 0; index < ACCESS_CODE_LENGTH; index++) {
    code += ACCESS_CODE_ALPHABET[randomInt(ACCESS_CODE_ALPHABET.length)];
  }

  return code.slice(0, 4) + "-" + code.slice(4, 8) + "-" + code.slice(8, 12);
}

export function normalizeAccessCode(input: string): string {
  return input.trim().toUpperCase().split("-").join("").split(" ").join("");
}

export function isAccessCodeFormatValid(normalized: string): boolean {
  return normalized.length === ACCESS_CODE_LENGTH
    && Array.from(normalized).every((character) => ACCESS_CODE_ALPHABET.includes(character));
}

export function hashAccessCode(input: string): string {
  return createHash("sha256").update(normalizeAccessCode(input)).digest("hex");
}

export function isMaxUsesValid(value: unknown): value is number {
  return typeof value === "number"
    && Number.isInteger(value)
    && value >= 1
    && value <= ACCESS_CODE_MAX_USES_LIMIT;
}

export function computeAccessCodeExpiry(now: Date): Date {
  return new Date(now.getTime() + ACCESS_CODE_TTL_HOURS * 60 * 60 * 1000);
}

export function getAccessCodeStatus(
  row: { expiresAt: Date; revokedAt: Date | null; usesCount: number; maxUses: number },
  now: Date,
): AccessCodeStatus {
  if (row.revokedAt !== null) return "revoked";
  if (row.expiresAt.getTime() <= now.getTime()) return "expired";
  if (row.usesCount >= row.maxUses) return "exhausted";
  return "usable";
}

export async function createAccessCode(
  universityId: string,
  maxUses: number,
  database?: AccessCodeDatabase,
  now = new Date(),
): Promise<CreateAccessCodeResult> {
  if (!isMaxUsesValid(maxUses)) return { ok: false, reason: "invalid_max_uses" };

  const expiresAt = computeAccessCodeExpiry(now);
  return (await resolveDatabase(database)).transaction(async (tx) => {
    let code = "";

    for (let attempt = 0; attempt < 3; attempt++) {
      code = generateAccessCode();
      const inserted = await tx
        .insert(schema.accessCodes)
        .values({
          universityId,
          codeHash: hashAccessCode(code),
          expiresAt,
          maxUses,
        })
        .onConflictDoNothing({ target: schema.accessCodes.codeHash })
        .returning({ id: schema.accessCodes.id });
      if (inserted.length > 0) {
        return {
          ok: true,
          id: inserted[0].id,
          code,
          expiresAt,
          maxUses,
        };
      }
    }

    return { ok: false, reason: "code_generation_failed" };
  });
}

export async function revokeAccessCode(
  universityId: string,
  codeId: string,
  database?: AccessCodeDatabase,
  now = new Date(),
): Promise<RevokeAccessCodeResult> {
  return (await resolveDatabase(database)).transaction(async (tx) => {
    const accessCodes = await tx
      .select({
        id: schema.accessCodes.id,
        revokedAt: schema.accessCodes.revokedAt,
      })
      .from(schema.accessCodes)
      .where(and(
        eq(schema.accessCodes.id, codeId),
        eq(schema.accessCodes.universityId, universityId),
      ))
      .for("update")
      .limit(1);
    if (!(accessCodes.length > 0)) return { ok: false, reason: "not_found" };
    if (accessCodes[0].revokedAt !== null) return { ok: true };

    await tx
      .update(schema.accessCodes)
      .set({ revokedAt: now })
      .where(and(
        eq(schema.accessCodes.id, codeId),
        eq(schema.accessCodes.universityId, universityId),
      ));

    return { ok: true };
  });
}

export type AccessCodeListItem = {
  id: string;
  createdAt: Date;
  expiresAt: Date;
  maxUses: number;
  usesCount: number;
  revokedAt: Date | null;
  status: AccessCodeStatus;
};

export async function listAccessCodes(
  universityId: string,
  database?: AccessCodeDatabase,
  now = new Date(),
): Promise<AccessCodeListItem[]> {
  const accessCodes = await (await resolveDatabase(database))
    .select({
      id: schema.accessCodes.id,
      createdAt: schema.accessCodes.createdAt,
      expiresAt: schema.accessCodes.expiresAt,
      maxUses: schema.accessCodes.maxUses,
      usesCount: schema.accessCodes.usesCount,
      revokedAt: schema.accessCodes.revokedAt,
    })
    .from(schema.accessCodes)
    .where(eq(schema.accessCodes.universityId, universityId))
    .orderBy(desc(schema.accessCodes.createdAt))
    .limit(50);

  return accessCodes.map((accessCode) => ({
    ...accessCode,
    status: getAccessCodeStatus(accessCode, now),
  }));
}
