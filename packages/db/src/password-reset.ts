import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { and, eq, gt, inArray, isNull, lt, sql } from "drizzle-orm";
import type { db as sharedDb } from "./client";
import * as schema from "./schema";
import { hashPassword, isPasswordValid } from "./password";
import { checkRateLimit, recordFailure } from "./auth-attempts";
import { getStudentEmailById } from "./login";

type PasswordResetDatabase = typeof sharedDb;

async function resolveDatabase(database?: PasswordResetDatabase): Promise<PasswordResetDatabase> {
  return database ?? (await import("./client")).db;
}

export const PASSWORD_RESET_CODE_TTL_MS = 10 * 60 * 1000;
export const PASSWORD_RESET_CODE_MAX_ATTEMPTS = 5;
export const PASSWORD_RESET_CODE_RESEND_DELAY_MS = 60000;

export type IssuePasswordResetResult =
  | { ok: true; code: string }
  | {
      ok: false;
      reason:
        | "not_found"
        | "not_student"
        | "not_admin"
        | "not_verified"
        | "no_password"
        | "too_soon";
    };

export type VerifyPasswordResetCodeResult =
  | { ok: true }
  | { ok: false; reason: "invalid_input" | "code_unavailable" | "invalid_code" };

export type SetPasswordResult =
  | { ok: true }
  | { ok: false; reason: "invalid_input" | "not_found" };

export type AdminPasswordResetRequestResult =
  | { kind: "issued"; userId: string; code: string }
  | { kind: "existing"; userId: string }
  | { kind: "unknown"; userId: string };

export type AdminPasswordResetResendResult =
  | { ok: true; email: string; code: string }
  | {
      ok: false;
      reason:
        | "not_found"
        | "not_verified"
        | "no_password"
        | "not_admin"
        | "too_soon"
        | "rate_limited";
    };

const ADMIN_PASSWORD_RESET_ROLES = ["super_admin", "university_admin"] as const;

export function generatePasswordResetCode(): string {
  return randomInt(0, 1000000).toString().padStart(6, "0");
}

export function hashPasswordResetCode(userId: string, code: string): string {
  return createHash("sha256").update(userId + ":" + code).digest("hex");
}

async function issuePasswordResetCodeForRoles(
  userId: string,
  allowedRoles: readonly ("student" | "super_admin" | "university_admin")[],
  roleFailureReason: "not_student" | "not_admin",
  now = new Date(),
  database?: PasswordResetDatabase,
): Promise<IssuePasswordResetResult> {
  try {
    return await (await resolveDatabase(database)).transaction(async (tx) => {
      const users = await tx
        .select({
          emailVerified: schema.users.emailVerified,
          passwordHash: schema.users.passwordHash,
          role: schema.users.role,
        })
        .from(schema.users)
        .where(eq(schema.users.id, userId))
        .limit(1);
      if (!(users.length > 0)) return { ok: false, reason: "not_found" };
      if (!allowedRoles.includes(users[0].role)) {
        return { ok: false, reason: roleFailureReason };
      }
      if (users[0].emailVerified === null) return { ok: false, reason: "not_verified" };
      if (users[0].passwordHash === null) return { ok: false, reason: "no_password" };

      const existingCodes = await tx
        .select({
          id: schema.passwordResetCodes.id,
          sentAt: schema.passwordResetCodes.sentAt,
        })
        .from(schema.passwordResetCodes)
        .where(eq(schema.passwordResetCodes.userId, userId))
        .limit(1);
      if (
        existingCodes.length > 0
        && existingCodes[0].sentAt.getTime() + PASSWORD_RESET_CODE_RESEND_DELAY_MS > now.getTime()
      ) {
        return { ok: false, reason: "too_soon" };
      }

      const code = generatePasswordResetCode();
      const values = {
        codeHash: hashPasswordResetCode(userId, code),
        expiresAt: new Date(now.getTime() + PASSWORD_RESET_CODE_TTL_MS),
        attempts: 0,
        sentAt: now,
        consumedAt: null,
      };
      if (existingCodes.length > 0) {
        await tx
          .update(schema.passwordResetCodes)
          .set(values)
          .where(eq(schema.passwordResetCodes.userId, userId));
      } else {
        await tx.insert(schema.passwordResetCodes).values({ userId, ...values });
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

export async function issuePasswordResetCode(
  userId: string,
  now = new Date(),
  database?: PasswordResetDatabase,
): Promise<IssuePasswordResetResult> {
  return issuePasswordResetCodeForRoles(userId, ["student"], "not_student", now, database);
}

export async function issueAdminPasswordResetCode(
  userId: string,
  now = new Date(),
  database?: PasswordResetDatabase,
): Promise<IssuePasswordResetResult> {
  return issuePasswordResetCodeForRoles(
    userId,
    ADMIN_PASSWORD_RESET_ROLES,
    "not_admin",
    now,
    database,
  );
}

export async function verifyPasswordResetCode(
  userId: string,
  code: string,
  now = new Date(),
  database?: PasswordResetDatabase,
): Promise<VerifyPasswordResetCodeResult> {
  const normalizedCode = typeof code === "string" ? code.trim() : "";
  if (normalizedCode.length !== 6) return { ok: false, reason: "invalid_input" };
  for (const character of normalizedCode) {
    const digit = character.charCodeAt(0);
    if (digit < 48 || digit > 57) return { ok: false, reason: "invalid_input" };
  }

  return (await resolveDatabase(database)).transaction(async (tx) => {
    const resetCodes = await tx
      .update(schema.passwordResetCodes)
      .set({ attempts: sql.raw("attempts + 1") })
      .where(and(
        eq(schema.passwordResetCodes.userId, userId),
        isNull(schema.passwordResetCodes.consumedAt),
        gt(schema.passwordResetCodes.expiresAt, now),
        lt(schema.passwordResetCodes.attempts, PASSWORD_RESET_CODE_MAX_ATTEMPTS),
      ))
      .returning({ codeHash: schema.passwordResetCodes.codeHash });
    if (!(resetCodes.length > 0)) return { ok: false, reason: "code_unavailable" };

    const storedHashHex = resetCodes[0].codeHash;
    const storedHash = Buffer.from(storedHashHex, "hex");
    const suppliedHash = Buffer.from(hashPasswordResetCode(userId, normalizedCode), "hex");
    if (
      storedHash.toString("hex") !== storedHashHex
      || storedHash.length !== suppliedHash.length
      || !timingSafeEqual(storedHash, suppliedHash)
    ) {
      return { ok: false, reason: "invalid_code" };
    }

    await tx
      .update(schema.passwordResetCodes)
      .set({ consumedAt: now })
      .where(eq(schema.passwordResetCodes.userId, userId));

    return { ok: true };
  });
}

export async function setStudentPassword(
  userId: string,
  password: string,
  database?: PasswordResetDatabase,
): Promise<SetPasswordResult> {
  if (!isPasswordValid(password)) return { ok: false, reason: "invalid_input" };

  return (await resolveDatabase(database)).transaction(async (tx) => {
    const updated = await tx
      .update(schema.users)
      .set({ passwordHash: hashPassword(password) })
      .where(eq(schema.users.id, userId))
      .returning({ id: schema.users.id });
    if (!(updated.length > 0)) return { ok: false, reason: "not_found" };

    await tx.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
    return { ok: true };
  });
}

export async function setAdminPassword(
  userId: string,
  password: string,
  database?: PasswordResetDatabase,
): Promise<SetPasswordResult> {
  if (!isPasswordValid(password)) return { ok: false, reason: "invalid_input" };

  return (await resolveDatabase(database)).transaction(async (tx) => {
    const updated = await tx
      .update(schema.users)
      .set({ passwordHash: hashPassword(password) })
      .where(and(
        eq(schema.users.id, userId),
        inArray(schema.users.role, ADMIN_PASSWORD_RESET_ROLES),
      ))
      .returning({ id: schema.users.id });
    if (!(updated.length > 0)) return { ok: false, reason: "not_found" };

    await tx.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
    return { ok: true };
  });
}

export const PASSWORD_RESET_UNKNOWN_USER_ID = "00000000-0000-0000-0000-000000000000";

export type PasswordResetRequestResult =
  | { kind: "issued"; userId: string; code: string }
  | { kind: "existing"; userId: string }
  | { kind: "unknown"; userId: string };

/**
 * Résout une demande de réinitialisation sans révéler l'existence du compte.
 * Renvoie toujours un identifiant (réel si le compte existe, sentinelle sinon)
 * afin que l'appelant pose un cookie dans tous les cas. Un code n'est émis que
 * pour un étudiant vérifié disposant d'un mot de passe, dans la limite de débit.
 */
export async function requestPasswordReset(
  universityId: string,
  email: string,
  database?: PasswordResetDatabase,
  now = new Date(),
): Promise<PasswordResetRequestResult> {
  const normalizedEmail = email.trim().toLowerCase();

  const users = await (await resolveDatabase(database))
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(and(
      eq(schema.users.email, normalizedEmail),
      eq(schema.users.universityId, universityId),
    ))
    .limit(1);
  if (!(users.length > 0)) {
    return { kind: "unknown", userId: PASSWORD_RESET_UNKNOWN_USER_ID };
  }
  const userId = users[0].id;

  const limit = await checkRateLimit("password_reset", normalizedEmail, now, database);
  if (!limit.allowed) return { kind: "existing", userId };

  const issued = await issuePasswordResetCode(userId, now, database);
  if (!issued.ok) return { kind: "existing", userId };

  await recordFailure("password_reset", normalizedEmail, now, database);
  return { kind: "issued", userId, code: issued.code };
}

export async function requestAdminPasswordReset(
  email: string,
  database?: PasswordResetDatabase,
  now = new Date(),
): Promise<AdminPasswordResetRequestResult> {
  const normalizedEmail = email.trim().toLowerCase();
  const users = await (await resolveDatabase(database))
    .select({ id: schema.users.id, role: schema.users.role })
    .from(schema.users)
    .where(eq(schema.users.email, normalizedEmail))
    .limit(1);
  if (!(users.length > 0)) {
    return { kind: "unknown", userId: PASSWORD_RESET_UNKNOWN_USER_ID };
  }
  if (users[0].role !== "super_admin" && users[0].role !== "university_admin") {
    return { kind: "unknown", userId: PASSWORD_RESET_UNKNOWN_USER_ID };
  }

  const userId = users[0].id;
  const limit = await checkRateLimit("password_reset", normalizedEmail, now, database);
  if (!limit.allowed) return { kind: "existing", userId };

  const issued = await issueAdminPasswordResetCode(userId, now, database);
  if (!issued.ok) return { kind: "existing", userId };

  await recordFailure("password_reset", normalizedEmail, now, database);
  return { kind: "issued", userId, code: issued.code };
}

export type ResendPasswordResetResult =
  | { ok: true; email: string; code: string }
  | {
      ok: false;
      reason:
        | "not_found"
        | "not_verified"
        | "no_password"
        | "not_student"
        | "too_soon"
        | "rate_limited";
    };

/**
 * Renvoie un code de réinitialisation pour un utilisateur déjà engagé dans le
 * flux (identifiant porté par le cookie de demande). Réémet un code uniquement
 * pour un étudiant vérifié disposant d'un mot de passe, dans la limite de débit.
 */
export async function resendPasswordResetCode(
  userId: string,
  database?: PasswordResetDatabase,
  now = new Date(),
): Promise<ResendPasswordResetResult> {
  const limit = await checkRateLimit("password_reset", userId, now, database);
  if (!limit.allowed) return { ok: false, reason: "rate_limited" };

  const issued = await issuePasswordResetCode(userId, now, database);
  if (!issued.ok) {
    switch (issued.reason) {
      case "too_soon":
        return { ok: false, reason: "too_soon" };
      case "not_found":
        return { ok: false, reason: "not_found" };
      case "not_verified":
        return { ok: false, reason: "not_verified" };
      case "no_password":
        return { ok: false, reason: "no_password" };
      case "not_student":
        return { ok: false, reason: "not_student" };
      default:
        return { ok: false, reason: "not_found" };
    }
  }

  await recordFailure("password_reset", userId, now, database);
  const email = await getStudentEmailById(userId, database);
  if (email === null) return { ok: false, reason: "not_found" };
  return { ok: true, email, code: issued.code };
}

export async function resendAdminPasswordResetCode(
  userId: string,
  database?: PasswordResetDatabase,
  now = new Date(),
): Promise<AdminPasswordResetResendResult> {
  const limit = await checkRateLimit("password_reset", userId, now, database);
  if (!limit.allowed) return { ok: false, reason: "rate_limited" };

  const issued = await issueAdminPasswordResetCode(userId, now, database);
  if (!issued.ok) {
    switch (issued.reason) {
      case "too_soon":
        return { ok: false, reason: "too_soon" };
      case "not_found":
        return { ok: false, reason: "not_found" };
      case "not_verified":
        return { ok: false, reason: "not_verified" };
      case "no_password":
        return { ok: false, reason: "no_password" };
      case "not_admin":
        return { ok: false, reason: "not_admin" };
      default:
        return { ok: false, reason: "not_found" };
    }
  }

  await recordFailure("password_reset", userId, now, database);
  const users = await (await resolveDatabase(database))
    .select({ email: schema.users.email })
    .from(schema.users)
    .where(and(
      eq(schema.users.id, userId),
      inArray(schema.users.role, ADMIN_PASSWORD_RESET_ROLES),
    ))
    .limit(1);
  if (!(users.length > 0) || users[0].email === null) {
    return { ok: false, reason: "not_found" };
  }
  return { ok: true, email: users[0].email, code: issued.code };
}
