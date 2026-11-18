import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "./client";
import * as schema from "./schema";
import { checkRateLimit, recordFailure } from "./auth-attempts";
import { verifyPassword as verifyStoredPassword } from "./password";

export const ADMIN_INVITATION_TTL_MS = 48 * 60 * 60 * 1000;
export const ADMIN_INVITATION_QUOTA = 10;
export const ADMIN_INVITATION_QUOTA_WINDOW_MS = 60 * 60 * 1000;
export const ADMIN_INVITATION_AUDIT_RETENTION_MONTHS = 12;

export function getAdminInvitationQuotaWindowStart(now: Date): Date {
  return new Date(now.getTime() - ADMIN_INVITATION_QUOTA_WINDOW_MS);
}

export function hasReachedAdminInvitationQuota(count: number): boolean {
  return count >= ADMIN_INVITATION_QUOTA;
}

export type AdminInvitationRole = "super_admin_editor" | "super_admin_lector";

type CreatedInvitation = {
  invitationId: string;
  auditId: string;
  role: AdminInvitationRole;
};

export type AdminInvitationRepository = {
  create: (input: {
    email: string;
    invitedByUserId: string;
    tokenHash: string;
    role: AdminInvitationRole;
    clientIp: string | null;
    createdAt: Date;
    expiresAt: Date;
    auditExpiresAt: Date;
  }) => Promise<
    | CreatedInvitation
    | "account_exists"
    | "inviter_not_allowed"
    | "quota_exceeded"
  >;
  revoke: (invitationId: string, revokedAt: Date) => Promise<boolean>;
};

export type AdminInvitationDependencies = {
  repository: AdminInvitationRepository;
  now?: () => Date;
  randomBytes?: (size: number) => Buffer;
};

export type CreateAdminInvitationResult =
  | {
      ok: true;
      invitationId: string;
      auditId: string;
      email: string;
      role: AdminInvitationRole;
      token: string;
      expiresAt: Date;
    }
  | {
      ok: false;
      reason:
        | "invalid_email"
        | "invalid_role"
        | "account_exists"
        | "inviter_not_allowed"
        | "quota_exceeded";
    };

export function isAdminInvitationRole(value: unknown): value is AdminInvitationRole {
  return value === "super_admin_editor" || value === "super_admin_lector";
}

export function normalizeAdminInvitationEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (
    email.length < 3
    || email.length > 255
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return null;
  }
  return email;
}

export function hashAdminInvitationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function isValidInvitationToken(token: unknown): token is string {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token)) return false;
  const bytes = Buffer.from(token, "base64url");
  return bytes.length === 32 && bytes.toString("base64url") === token;
}

export function createAdminInvitationService({
  repository,
  now = () => new Date(),
  randomBytes: createRandomBytes = randomBytes,
}: AdminInvitationDependencies) {
  return {
    async createAdminInvitation(
      emailInput: unknown,
      invitedByUserId: string,
      roleInput: unknown,
      clientIp: string | null,
    ): Promise<CreateAdminInvitationResult> {
      const email = normalizeAdminInvitationEmail(emailInput);
      if (email === null) return { ok: false, reason: "invalid_email" };
      if (!isAdminInvitationRole(roleInput)) {
        return { ok: false, reason: "invalid_role" };
      }

      const createdAt = now();
      const tokenBytes = createRandomBytes(32);
      if (tokenBytes.length !== 32) {
        throw new Error("Génération du jeton d’invitation invalide.");
      }

      const token = tokenBytes.toString("base64url");
      const result = await repository.create({
        email,
        invitedByUserId,
        tokenHash: hashAdminInvitationToken(token),
        role: roleInput,
        clientIp,
        createdAt,
        expiresAt: new Date(createdAt.getTime() + ADMIN_INVITATION_TTL_MS),
        auditExpiresAt: addUtcMonths(createdAt, ADMIN_INVITATION_AUDIT_RETENTION_MONTHS),
      });
      if (result === "account_exists") return { ok: false, reason: "account_exists" };
      if (result === "inviter_not_allowed") return { ok: false, reason: "inviter_not_allowed" };
      if (result === "quota_exceeded") return { ok: false, reason: "quota_exceeded" };

      return {
        ok: true,
        invitationId: result.invitationId,
        auditId: result.auditId,
        email,
        role: result.role,
        token,
        expiresAt: new Date(createdAt.getTime() + ADMIN_INVITATION_TTL_MS),
      };
    },

    async revokeAdminInvitation(invitationId: string): Promise<boolean> {
      return repository.revoke(invitationId, now());
    },
  };
}

function addUtcMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(
    result.getUTCFullYear(),
    result.getUTCMonth() + 1,
    0,
  )).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

const service = createAdminInvitationService({
  repository: {
    async create({
      email,
      invitedByUserId,
      tokenHash,
      role,
      clientIp,
      createdAt,
      expiresAt,
      auditExpiresAt,
    }) {
      return db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${email}))`);

        const inviters = await tx
          .select({
            id: schema.users.id,
            email: schema.users.email,
            role: schema.users.role,
          })
          .from(schema.users)
          .where(and(
            eq(schema.users.id, invitedByUserId),
            isNull(schema.users.revokedAt),
          ))
          .for("update")
          .limit(1);
        if (!(inviters.length > 0)) return "inviter_not_allowed";
        const inviter = inviters[0];
        if (
          (role === "super_admin_editor" && inviter.role !== "super_admin")
          || (
            role === "super_admin_lector"
            && inviter.role !== "super_admin"
            && inviter.role !== "super_admin_editor"
          )
        ) {
          return "inviter_not_allowed";
        }

        const [existingUser] = await tx
          .select({ id: schema.users.id })
          .from(schema.users)
          .where(sql`lower(${schema.users.email}) = ${email}`)
          .limit(1);
        if (existingUser) return "account_exists";

        const quotaStart = getAdminInvitationQuotaWindowStart(createdAt);
        const quotaRows = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(schema.adminInvitationAudit)
          .where(and(
            eq(schema.adminInvitationAudit.invitedByUserId, invitedByUserId),
            gt(schema.adminInvitationAudit.createdAt, quotaStart),
          ));
        if (hasReachedAdminInvitationQuota(quotaRows[0]?.count ?? 0)) {
          return "quota_exceeded";
        }

        await tx
          .update(schema.adminInvitations)
          .set({ revokedAt: createdAt })
          .where(and(
            sql`lower(${schema.adminInvitations.email}) = ${email}`,
            isNull(schema.adminInvitations.consumedAt),
            isNull(schema.adminInvitations.revokedAt),
          ));

        const invitations = await tx
          .insert(schema.adminInvitations)
          .values({ email, invitedByUserId, tokenHash, role, createdAt, expiresAt })
          .returning({
            id: schema.adminInvitations.id,
            role: schema.adminInvitations.role,
          });
        if (!(invitations.length > 0)) {
          throw new Error("Échec de création de l’invitation.");
        }
        const invitation = invitations[0];
        if (!invitation || !isAdminInvitationRole(invitation.role)) {
          throw new Error("Échec de création de l’invitation.");
        }

        const audits = await tx
          .insert(schema.adminInvitationAudit)
          .values({
            invitationId: invitation.id,
            invitedByUserId,
            inviterEmail: inviter.email,
            invitedEmail: email,
            role: invitation.role,
            clientIp,
            createdAt,
            expiresAt: auditExpiresAt,
          })
          .returning({ id: schema.adminInvitationAudit.id });
        if (!(audits.length > 0)) {
          throw new Error("Échec d’écriture du journal d’invitation.");
        }

        return {
          invitationId: invitation.id,
          auditId: audits[0].id,
          role: invitation.role,
        };
      });
    },

    async revoke(invitationId, revokedAt) {
      const [revoked] = await db
        .update(schema.adminInvitations)
        .set({ revokedAt })
        .where(and(
          eq(schema.adminInvitations.id, invitationId),
          isNull(schema.adminInvitations.consumedAt),
          isNull(schema.adminInvitations.revokedAt),
        ))
        .returning({ id: schema.adminInvitations.id });
      return Boolean(revoked);
    },
  },
});

export const createAdminInvitation = service.createAdminInvitation;
export const revokeAdminInvitation = service.revokeAdminInvitation;

export type AdminInvitationStepUpResult =
  | { ok: true }
  | {
      ok: false;
      reason: "not_allowed" | "no_password" | "invalid_password" | "rate_limited";
    };

export type AdminInvitationStepUpVerifierDependencies = {
  checkRateLimit: (
    action: "login",
    identifier: string,
  ) => Promise<{ allowed: boolean }>;
  recordFailure: (action: "login", identifier: string) => Promise<unknown>;
  verifyPassword: (password: string, passwordHash: string) => boolean;
};

export function createAdminInvitationStepUpVerifier({
  checkRateLimit: checkLimit,
  recordFailure: storeFailure,
  verifyPassword,
}: AdminInvitationStepUpVerifierDependencies) {
  return async (
    userId: string,
    password: unknown,
    passwordHash: string,
  ): Promise<AdminInvitationStepUpResult> => {
    const identifier = `admin-invitation-editor:${userId}`;
    const limit = await checkLimit("login", identifier);
    if (!limit.allowed) return { ok: false, reason: "rate_limited" };
    if (typeof password !== "string" || !verifyPassword(password, passwordHash)) {
      await storeFailure("login", identifier);
      return { ok: false, reason: "invalid_password" };
    }
    return { ok: true };
  };
}

const verifyInvitationEditorPassword = createAdminInvitationStepUpVerifier({
  checkRateLimit,
  recordFailure,
  verifyPassword: verifyStoredPassword,
});

export async function verifyAdminInvitationStepUp(
  userId: string,
  password: unknown,
): Promise<AdminInvitationStepUpResult> {
  const users = await db
    .select({
      role: schema.users.role,
      passwordHash: schema.users.passwordHash,
    })
    .from(schema.users)
    .where(and(
      eq(schema.users.id, userId),
      isNull(schema.users.revokedAt),
    ))
    .limit(1);
  if (!(users.length > 0) || users[0].role !== "super_admin") {
    return { ok: false, reason: "not_allowed" };
  }
  if (users[0].passwordHash === null) {
    return { ok: false, reason: "no_password" };
  }
  return verifyInvitationEditorPassword(userId, password, users[0].passwordHash);
}
