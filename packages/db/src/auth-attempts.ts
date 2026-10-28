import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import type { db as sharedDb } from "./client";
import * as schema from "./schema";

type AuthAttemptsDatabase = typeof sharedDb;

async function resolveDatabase(database?: AuthAttemptsDatabase): Promise<AuthAttemptsDatabase> {
  return database ?? (await import("./client")).db;
}

export type AuthAttemptAction = "login" | "signup_code" | "email_send";

export type RateLimit = {
  maxAttempts: number;
  windowMs: number;
  blockMs: number;
};

export const RATE_LIMITS: Record<AuthAttemptAction, RateLimit> = {
  login: { maxAttempts: 5, windowMs: 900000, blockMs: 900000 },
  signup_code: { maxAttempts: 5, windowMs: 900000, blockMs: 900000 },
  email_send: { maxAttempts: 5, windowMs: 3600000, blockMs: 3600000 },
};

export function hashAttemptKey(action: AuthAttemptAction, identifier: string): string {
  const normalizedIdentifier = typeof identifier === "string" ? identifier.trim().toLowerCase() : "";
  return createHash("sha256").update(action + ":" + normalizedIdentifier).digest("hex");
}

export async function checkRateLimit(
  action: AuthAttemptAction,
  identifier: string,
  now = new Date(),
  database?: AuthAttemptsDatabase,
): Promise<{ allowed: boolean; retryAt?: Date }> {
  const keyHash = hashAttemptKey(action, identifier);
  const attempts = await (await resolveDatabase(database))
    .select({
      blockedUntil: schema.authAttempts.blockedUntil,
    })
    .from(schema.authAttempts)
    .where(eq(schema.authAttempts.keyHash, keyHash))
    .limit(1);

  if (!(attempts.length > 0)) return { allowed: true };
  const blockedUntil = attempts[0].blockedUntil;
  if (blockedUntil !== null && blockedUntil.getTime() > now.getTime()) {
    return { allowed: false, retryAt: blockedUntil };
  }

  return { allowed: true };
}

export async function recordFailure(
  action: AuthAttemptAction,
  identifier: string,
  now = new Date(),
  database?: AuthAttemptsDatabase,
): Promise<{ attempts: number; blockedUntil: Date | null }> {
  const limit = RATE_LIMITS[action];
  const keyHash = hashAttemptKey(action, identifier);
  const db = await resolveDatabase(database);
  const nowIso = now.toISOString();
  const nextBlockedAtIso = new Date(now.getTime() + limit.blockMs).toISOString();

  const result = await db.execute(sql`
    INSERT INTO auth_attempts (key_hash, attempts, window_started_at, blocked_until, created_at)
    VALUES (${keyHash}, 1, ${nowIso}::timestamptz, NULL, ${nowIso}::timestamptz)
    ON CONFLICT (key_hash) DO UPDATE SET
      attempts = CASE
        WHEN auth_attempts.blocked_until IS NOT NULL AND auth_attempts.blocked_until > ${nowIso}::timestamptz THEN auth_attempts.attempts + 1
        WHEN auth_attempts.window_started_at + (${limit.windowMs}::integer * interval '1 millisecond') <= ${nowIso}::timestamptz THEN 1
        ELSE auth_attempts.attempts + 1
      END,
      window_started_at = CASE
        WHEN auth_attempts.blocked_until IS NOT NULL AND auth_attempts.blocked_until > ${nowIso}::timestamptz THEN auth_attempts.window_started_at
        WHEN auth_attempts.window_started_at + (${limit.windowMs}::integer * interval '1 millisecond') <= ${nowIso}::timestamptz THEN ${nowIso}::timestamptz
        ELSE auth_attempts.window_started_at
      END,
      blocked_until = CASE
        WHEN auth_attempts.blocked_until IS NOT NULL AND auth_attempts.blocked_until > ${nowIso}::timestamptz THEN auth_attempts.blocked_until
        WHEN auth_attempts.window_started_at + (${limit.windowMs}::integer * interval '1 millisecond') <= ${nowIso}::timestamptz THEN NULL
        WHEN auth_attempts.attempts + 1 >= ${limit.maxAttempts} THEN ${nextBlockedAtIso}::timestamptz
        ELSE auth_attempts.blocked_until
      END
    RETURNING attempts, blocked_until
  `);

  const row = result.rows[0] as { attempts?: number | string; blocked_until?: string | Date | null } | undefined;
  return {
    attempts: Number(row?.attempts ?? 0),
    blockedUntil: row?.blocked_until ? new Date(row.blocked_until) : null,
  };
}

export async function resetAttempts(
  action: AuthAttemptAction,
  identifier: string,
  database?: AuthAttemptsDatabase,
): Promise<void> {
  const keyHash = hashAttemptKey(action, identifier);
  await (await resolveDatabase(database))
    .delete(schema.authAttempts)
    .where(eq(schema.authAttempts.keyHash, keyHash));
}
