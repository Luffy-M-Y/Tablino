import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { and, eq, gt, isNull, lt, sql } from "drizzle-orm";
import type { db as sharedDb } from "./client";
import * as schema from "./schema";

type EmailVerificationDatabase = typeof sharedDb;

async function resolveDatabase(database?: EmailVerificationDatabase): Promise<EmailVerificationDatabase> {
  return database ?? (await import("./client")).db;
}

export const EMAIL_CODE_TTL_MS = 10 * 60 * 1000;
export const EMAIL_CODE_MAX_ATTEMPTS = 5;
export const EMAIL_CODE_RESEND_DELAY_MS = 60000;

export type IssueEmailVerificationResult =
  | { ok: true; code: string }
  | { ok: false; reason: "not_found" | "already_verified" | "too_soon" };

export type VerifyEmailCodeResult =
  | { ok: true }
  | { ok: false; reason: "invalid_input" | "code_unavailable" | "invalid_code" };

export function generateEmailVerificationCode(): string {
  return randomInt(0, 1000000).toString().padStart(6, "0");
}

export function hashEmailVerificationCode(userId: string, code: string): string {
  return createHash("sha256").update(userId + ":" + code).digest("hex");
}

export async function issueEmailVerificationCode(
  userId: string,
  now = new Date(),
  database?: EmailVerificationDatabase,
): Promise<IssueEmailVerificationResult> {
  try {
    return await (await resolveDatabase(database)).transaction(async (tx) => {
      const users = await tx
        .select({ emailVerified: schema.users.emailVerified })
        .from(schema.users)
        .where(eq(schema.users.id, userId))
        .limit(1);
      if (!(users.length > 0)) return { ok: false, reason: "not_found" };
      if (users[0].emailVerified !== null) return { ok: false, reason: "already_verified" };

      const existingCodes = await tx
        .select({
          id: schema.emailVerificationCodes.id,
          sentAt: schema.emailVerificationCodes.sentAt,
        })
        .from(schema.emailVerificationCodes)
        .where(eq(schema.emailVerificationCodes.userId, userId))
        .limit(1);
      if (
        existingCodes.length > 0
        && existingCodes[0].sentAt.getTime() + EMAIL_CODE_RESEND_DELAY_MS > now.getTime()
      ) {
        return { ok: false, reason: "too_soon" };
      }

      const code = generateEmailVerificationCode();
      const values = {
        codeHash: hashEmailVerificationCode(userId, code),
        expiresAt: new Date(now.getTime() + EMAIL_CODE_TTL_MS),
        attempts: 0,
        sentAt: now,
        consumedAt: null,
      };
      if (existingCodes.length > 0) {
        await tx
          .update(schema.emailVerificationCodes)
          .set(values)
          .where(eq(schema.emailVerificationCodes.userId, userId));
      } else {
        await tx.insert(schema.emailVerificationCodes).values({ userId, ...values });
      }

      return { ok: true, code };
    });
  } catch (error) {
    if (
      typeof error === "object"
      && error !== null
      && "code" in error
      && error.code === "23505"
    ) {
      return { ok: false, reason: "too_soon" };
    }
    throw error;
  }
}

export async function verifyEmailCode(
  userId: string,
  code: string,
  now = new Date(),
  database?: EmailVerificationDatabase,
): Promise<VerifyEmailCodeResult> {
  const normalizedCode = typeof code === "string" ? code.trim() : "";
  if (normalizedCode.length !== 6) return { ok: false, reason: "invalid_input" };
  for (const character of normalizedCode) {
    const digit = character.charCodeAt(0);
    if (digit < 48 || digit > 57) return { ok: false, reason: "invalid_input" };
  }

  return (await resolveDatabase(database)).transaction(async (tx) => {
    const verificationCodes = await tx
      .update(schema.emailVerificationCodes)
      .set({ attempts: sql.raw("attempts + 1") })
      .where(and(
        eq(schema.emailVerificationCodes.userId, userId),
        isNull(schema.emailVerificationCodes.consumedAt),
        gt(schema.emailVerificationCodes.expiresAt, now),
        lt(schema.emailVerificationCodes.attempts, EMAIL_CODE_MAX_ATTEMPTS),
      ))
      .returning({ codeHash: schema.emailVerificationCodes.codeHash });
    if (!(verificationCodes.length > 0)) return { ok: false, reason: "code_unavailable" };

    const storedHashHex = verificationCodes[0].codeHash;
    const storedHash = Buffer.from(storedHashHex, "hex");
    const suppliedHash = Buffer.from(hashEmailVerificationCode(userId, normalizedCode), "hex");
    if (
      storedHash.toString("hex") !== storedHashHex
      || storedHash.length !== suppliedHash.length
      || !timingSafeEqual(storedHash, suppliedHash)
    ) {
      return { ok: false, reason: "invalid_code" };
    }

    await tx
      .update(schema.emailVerificationCodes)
      .set({ consumedAt: now })
      .where(eq(schema.emailVerificationCodes.userId, userId));
    await tx
      .update(schema.users)
      .set({ emailVerified: now })
      .where(and(
        eq(schema.users.id, userId),
        isNull(schema.users.emailVerified),
      ));

    return { ok: true };
  });
}
