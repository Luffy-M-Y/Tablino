import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { and, eq, gt, isNull, lt } from "drizzle-orm";
import type { db as sharedDb } from "./client";
import * as schema from "./schema";
import {
  hashAdminInvitationToken,
  isAdminInvitationRole,
  isValidInvitationToken,
  type AdminInvitationRole,
} from "./admin-invitation";
import { hashPassword, isPasswordValid } from "./password";
import {
  isAdminInvitationCodeAttemptAllowed,
  isAdminInvitationCodeResendAllowed,
} from "./admin-invitation-otp-state.mjs";

type InvitationOtpDatabase = typeof sharedDb;

async function resolveDatabase(database?: InvitationOtpDatabase): Promise<InvitationOtpDatabase> {
  return database ?? (await import("./client")).db;
}

export const ADMIN_INVITATION_CODE_TTL_MS = 10 * 60 * 1000;
export const ADMIN_INVITATION_CODE_MAX_ATTEMPTS = 5;
export const ADMIN_INVITATION_CODE_RESEND_DELAY_MS = 60 * 1000;

export type StartAdminInvitationAcceptanceResult =
  | { ok: true; email: string; code: string }
  | {
      ok: false;
      reason:
        | "invalid_password"
        | "password_mismatch"
        | "invitation_unavailable"
        | "too_soon";
    };

export type ResendAdminInvitationCodeResult =
  | { ok: true; email: string; code: string }
  | { ok: false; reason: "invitation_unavailable" | "too_soon" };

export type ConsumeAdminInvitationCodeResult =
  | { ok: true; role: AdminInvitationRole }
  | {
      ok: false;
      reason:
        | "invalid_input"
        | "invitation_unavailable"
        | "code_unavailable"
        | "invalid_code";
    };

export function generateAdminInvitationCode(): string {
  return randomInt(0, 1000000).toString().padStart(6, "0");
}

export function hashAdminInvitationCode(token: string, code: string): string {
  const tokenHash = hashAdminInvitationToken(token);
  return createHash("sha256").update(tokenHash + ":" + code).digest("hex");
}

function isSixDigitCode(value: unknown): value is string {
  return typeof value === "string" && /^\d{6}$/.test(value.trim());
}

function constantTimeHexEquals(leftHex: string, rightHex: string): boolean {
  const left = Buffer.from(leftHex, "hex");
  const right = Buffer.from(rightHex, "hex");
  return left.toString("hex") === leftHex
    && right.toString("hex") === rightHex
    && left.length === right.length
    && timingSafeEqual(left, right);
}

export async function startAdminInvitationAcceptance(
  token: unknown,
  password: unknown,
  passwordConfirmation: unknown,
  now = new Date(),
  database?: InvitationOtpDatabase,
): Promise<StartAdminInvitationAcceptanceResult> {
  if (!isPasswordValid(password)) return { ok: false, reason: "invalid_password" };
  if (typeof passwordConfirmation !== "string" || password !== passwordConfirmation) {
    return { ok: false, reason: "password_mismatch" };
  }
  if (!isValidInvitationToken(token)) {
    return { ok: false, reason: "invitation_unavailable" };
  }

  const code = generateAdminInvitationCode();
  const result = await (await resolveDatabase(database)).transaction(async (tx) => {
    const invitations = await tx
      .select({
        id: schema.adminInvitations.id,
        email: schema.adminInvitations.email,
      })
      .from(schema.adminInvitations)
      .where(and(
        eq(schema.adminInvitations.tokenHash, hashAdminInvitationToken(token)),
        isNull(schema.adminInvitations.consumedAt),
        isNull(schema.adminInvitations.revokedAt),
        gt(schema.adminInvitations.expiresAt, now),
      ))
      .for("update")
      .limit(1);
    if (!(invitations.length > 0)) return { ok: false as const, reason: "invitation_unavailable" as const };

    const invitation = invitations[0];
    const existing = await tx
      .select({ id: schema.adminInvitationCodes.id, sentAt: schema.adminInvitationCodes.sentAt })
      .from(schema.adminInvitationCodes)
      .where(eq(schema.adminInvitationCodes.invitationId, invitation.id))
      .limit(1);
    if (
      existing.length > 0
      && !isAdminInvitationCodeResendAllowed(
        existing[0].sentAt,
        now,
        ADMIN_INVITATION_CODE_RESEND_DELAY_MS,
      )
    ) {
      return { ok: false as const, reason: "too_soon" as const };
    }

    const values = {
      codeHash: hashAdminInvitationCode(token, code),
      passwordHash: hashPassword(password),
      expiresAt: new Date(now.getTime() + ADMIN_INVITATION_CODE_TTL_MS),
      attempts: 0,
      sentAt: now,
      consumedAt: null,
    };
    if (existing.length > 0) {
      await tx
        .update(schema.adminInvitationCodes)
        .set(values)
        .where(eq(schema.adminInvitationCodes.id, existing[0].id));
    } else {
      await tx.insert(schema.adminInvitationCodes).values({
        invitationId: invitation.id,
        ...values,
      });
    }
    return { ok: true as const, email: invitation.email };
  });

  return result.ok ? { ...result, code } : result;
}

export async function resendAdminInvitationCode(
  token: unknown,
  now = new Date(),
  database?: InvitationOtpDatabase,
): Promise<ResendAdminInvitationCodeResult> {
  if (!isValidInvitationToken(token)) {
    return { ok: false, reason: "invitation_unavailable" };
  }

  const code = generateAdminInvitationCode();
  const result = await (await resolveDatabase(database)).transaction(async (tx) => {
    const invitations = await tx
      .select({
        id: schema.adminInvitations.id,
        email: schema.adminInvitations.email,
      })
      .from(schema.adminInvitations)
      .where(and(
        eq(schema.adminInvitations.tokenHash, hashAdminInvitationToken(token)),
        isNull(schema.adminInvitations.consumedAt),
        isNull(schema.adminInvitations.revokedAt),
        gt(schema.adminInvitations.expiresAt, now),
      ))
      .for("update")
      .limit(1);
    if (!(invitations.length > 0)) return { ok: false as const, reason: "invitation_unavailable" as const };

    const invitation = invitations[0];
    const codes = await tx
      .select()
      .from(schema.adminInvitationCodes)
      .where(eq(schema.adminInvitationCodes.invitationId, invitation.id))
      .for("update")
      .limit(1);
    if (!(codes.length > 0)) {
      return { ok: false as const, reason: "invitation_unavailable" as const };
    }
    if (!isAdminInvitationCodeResendAllowed(
      codes[0].sentAt,
      now,
      ADMIN_INVITATION_CODE_RESEND_DELAY_MS,
    )) {
      return { ok: false as const, reason: "too_soon" as const };
    }

    await tx
      .update(schema.adminInvitationCodes)
      .set({
        codeHash: hashAdminInvitationCode(token, code),
        expiresAt: new Date(now.getTime() + ADMIN_INVITATION_CODE_TTL_MS),
        attempts: 0,
        sentAt: now,
        consumedAt: null,
      })
      .where(eq(schema.adminInvitationCodes.id, codes[0].id));
    return { ok: true as const, email: invitation.email };
  });

  return result.ok ? { ...result, code } : result;
}

const userNotCreated = new Error("Invitation account creation failed.");

export async function consumeAdminInvitationCode(
  token: unknown,
  codeInput: unknown,
  now = new Date(),
  database?: InvitationOtpDatabase,
): Promise<ConsumeAdminInvitationCodeResult> {
  if (!isSixDigitCode(codeInput)) return { ok: false, reason: "invalid_input" };
  if (!isValidInvitationToken(token)) {
    return { ok: false, reason: "invitation_unavailable" };
  }
  const code = codeInput.trim();

  try {
    return await (await resolveDatabase(database)).transaction(async (tx) => {
      const invitations = await tx
        .select({
          id: schema.adminInvitations.id,
          email: schema.adminInvitations.email,
          role: schema.adminInvitations.role,
        })
        .from(schema.adminInvitations)
        .where(and(
          eq(schema.adminInvitations.tokenHash, hashAdminInvitationToken(token)),
          isNull(schema.adminInvitations.consumedAt),
          isNull(schema.adminInvitations.revokedAt),
          gt(schema.adminInvitations.expiresAt, now),
        ))
        .for("update")
        .limit(1);
      if (!(invitations.length > 0)) {
        return { ok: false, reason: "invitation_unavailable" };
      }

      const invitation = invitations[0];
      if (!isAdminInvitationRole(invitation.role)) {
        throw new Error("Rôle d’invitation invalide.");
      }
      const availableCodes = await tx
        .select({
          id: schema.adminInvitationCodes.id,
          codeHash: schema.adminInvitationCodes.codeHash,
          passwordHash: schema.adminInvitationCodes.passwordHash,
          attempts: schema.adminInvitationCodes.attempts,
          expiresAt: schema.adminInvitationCodes.expiresAt,
          consumedAt: schema.adminInvitationCodes.consumedAt,
        })
        .from(schema.adminInvitationCodes)
        .where(eq(schema.adminInvitationCodes.invitationId, invitation.id))
        .for("update")
        .limit(1);
      const availableCode = availableCodes[0];
      if (availableCode === undefined) {
        return { ok: false, reason: "code_unavailable" };
      }
      if (!isAdminInvitationCodeAttemptAllowed(
        availableCode,
        now,
        ADMIN_INVITATION_CODE_MAX_ATTEMPTS,
      )) {
        return { ok: false, reason: "code_unavailable" };
      }
      const codeRow = availableCode;
      await tx
        .update(schema.adminInvitationCodes)
        .set({ attempts: codeRow.attempts + 1 })
        .where(and(
          eq(schema.adminInvitationCodes.id, codeRow.id),
          isNull(schema.adminInvitationCodes.consumedAt),
          gt(schema.adminInvitationCodes.expiresAt, now),
          lt(schema.adminInvitationCodes.attempts, ADMIN_INVITATION_CODE_MAX_ATTEMPTS),
        ));
      if (!constantTimeHexEquals(
        codeRow.codeHash,
        hashAdminInvitationCode(token, code),
      )) {
        return { ok: false, reason: "invalid_code" };
      }

      const users = await tx
        .insert(schema.users)
        .values({
          email: invitation.email,
          emailVerified: now,
          passwordHash: codeRow.passwordHash,
          role: invitation.role,
          universityId: null,
        })
        .onConflictDoNothing()
        .returning({ id: schema.users.id });
      if (!(users.length > 0)) throw userNotCreated;

      const accepted = await tx
        .update(schema.adminInvitations)
        .set({ consumedAt: now, acceptedUserId: users[0].id })
        .where(and(
          eq(schema.adminInvitations.id, invitation.id),
          isNull(schema.adminInvitations.consumedAt),
          isNull(schema.adminInvitations.revokedAt),
          gt(schema.adminInvitations.expiresAt, now),
        ))
        .returning({ id: schema.adminInvitations.id });
      if (!(accepted.length > 0)) {
        throw new Error("Échec de consommation de l’invitation.");
      }
      await tx
        .update(schema.adminInvitationCodes)
        .set({ consumedAt: now })
        .where(eq(schema.adminInvitationCodes.id, codeRow.id));
      return { ok: true, role: invitation.role };
    });
  } catch (error) {
    if (error === userNotCreated) {
      return { ok: false, reason: "invitation_unavailable" };
    }
    throw error;
  }
}
