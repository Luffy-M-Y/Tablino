import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "./client";
import * as schema from "./schema";
import { hashPassword as hashUserPassword, isPasswordValid } from "./password";

export const SUPER_ADMIN_EDITOR_INVITATION_TTL_MS = 48 * 60 * 60 * 1000;

type CreatedInvitation = {
  invitationId: string;
};

export type SuperAdminEditorInvitationRepository = {
  create: (input: {
    email: string;
    invitedByUserId: string;
    tokenHash: string;
    createdAt: Date;
    expiresAt: Date;
  }) => Promise<CreatedInvitation | "account_exists" | "inviter_not_allowed">;
  revoke: (invitationId: string, revokedAt: Date) => Promise<boolean>;
  consume: (input: {
    tokenHash: string;
    passwordHash: string;
    now: Date;
  }) => Promise<boolean>;
};

export type SuperAdminEditorInvitationDependencies = {
  repository: SuperAdminEditorInvitationRepository;
  now?: () => Date;
  randomBytes?: (size: number) => Buffer;
  hashPassword?: (password: string) => string;
  isPasswordValid?: (password: unknown) => password is string;
};

export type CreateSuperAdminEditorInvitationResult =
  | {
      ok: true;
      invitationId: string;
      email: string;
      token: string;
      expiresAt: Date;
    }
  | {
      ok: false;
      reason: "invalid_email" | "account_exists" | "inviter_not_allowed";
    };

export type ConsumeSuperAdminEditorInvitationResult =
  | { ok: true }
  | { ok: false; reason: "invalid_password" | "invitation_unavailable" };

export function normalizeSuperAdminEditorInvitationEmail(value: unknown): string | null {
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

export function hashSuperAdminEditorInvitationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function isValidInvitationToken(token: unknown): token is string {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token)) return false;
  const bytes = Buffer.from(token, "base64url");
  return bytes.length === 32 && bytes.toString("base64url") === token;
}

export function createSuperAdminEditorInvitationService({
  repository,
  now = () => new Date(),
  randomBytes: createRandomBytes = randomBytes,
  hashPassword = hashUserPassword,
  isPasswordValid: validatePassword = isPasswordValid,
}: SuperAdminEditorInvitationDependencies) {
  return {
    async createSuperAdminEditorInvitation(
      emailInput: unknown,
      invitedByUserId: string,
    ): Promise<CreateSuperAdminEditorInvitationResult> {
      const email = normalizeSuperAdminEditorInvitationEmail(emailInput);
      if (email === null) return { ok: false, reason: "invalid_email" };

      const createdAt = now();
      const tokenBytes = createRandomBytes(32);
      if (tokenBytes.length !== 32) {
        throw new Error("Génération du jeton d’invitation invalide.");
      }

      const token = tokenBytes.toString("base64url");
      const result = await repository.create({
        email,
        invitedByUserId,
        tokenHash: hashSuperAdminEditorInvitationToken(token),
        createdAt,
        expiresAt: new Date(createdAt.getTime() + SUPER_ADMIN_EDITOR_INVITATION_TTL_MS),
      });
      if (result === "account_exists") return { ok: false, reason: "account_exists" };
      if (result === "inviter_not_allowed") return { ok: false, reason: "inviter_not_allowed" };

      return {
        ok: true,
        invitationId: result.invitationId,
        email,
        token,
        expiresAt: new Date(createdAt.getTime() + SUPER_ADMIN_EDITOR_INVITATION_TTL_MS),
      };
    },

    async revokeSuperAdminEditorInvitation(invitationId: string): Promise<boolean> {
      return repository.revoke(invitationId, now());
    },

    async consumeSuperAdminEditorInvitation(
      token: unknown,
      password: unknown,
    ): Promise<ConsumeSuperAdminEditorInvitationResult> {
      if (!validatePassword(password)) return { ok: false, reason: "invalid_password" };
      if (!isValidInvitationToken(token)) {
        return { ok: false, reason: "invitation_unavailable" };
      }

      const consumed = await repository.consume({
        tokenHash: hashSuperAdminEditorInvitationToken(token),
        passwordHash: hashPassword(password),
        now: now(),
      });
      return consumed
        ? { ok: true }
        : { ok: false, reason: "invitation_unavailable" };
    },
  };
}

const service = createSuperAdminEditorInvitationService({
  repository: {
    async create({ email, invitedByUserId, tokenHash, createdAt, expiresAt }) {
      return db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${email}))`);

        const [inviter] = await tx
          .select({ id: schema.users.id })
          .from(schema.users)
          .where(and(
            eq(schema.users.id, invitedByUserId),
            eq(schema.users.role, "super_admin"),
            isNull(schema.users.revokedAt),
          ))
          .for("share")
          .limit(1);
        if (!inviter) return "inviter_not_allowed";

        const [existingUser] = await tx
          .select({ id: schema.users.id })
          .from(schema.users)
          .where(sql`lower(${schema.users.email}) = ${email}`)
          .limit(1);
        if (existingUser) return "account_exists";

        await tx
          .update(schema.superAdminEditorInvitations)
          .set({ revokedAt: createdAt })
          .where(and(
            sql`lower(${schema.superAdminEditorInvitations.email}) = ${email}`,
            isNull(schema.superAdminEditorInvitations.consumedAt),
            isNull(schema.superAdminEditorInvitations.revokedAt),
          ));

        const [invitation] = await tx
          .insert(schema.superAdminEditorInvitations)
          .values({ email, invitedByUserId, tokenHash, createdAt, expiresAt })
          .returning({ id: schema.superAdminEditorInvitations.id });
        if (!invitation) throw new Error("Échec de création de l’invitation.");
        return { invitationId: invitation.id };
      });
    },

    async revoke(invitationId, revokedAt) {
      const [revoked] = await db
        .update(schema.superAdminEditorInvitations)
        .set({ revokedAt })
        .where(and(
          eq(schema.superAdminEditorInvitations.id, invitationId),
          isNull(schema.superAdminEditorInvitations.consumedAt),
          isNull(schema.superAdminEditorInvitations.revokedAt),
        ))
        .returning({ id: schema.superAdminEditorInvitations.id });
      return Boolean(revoked);
    },

    async consume({ tokenHash, passwordHash, now }) {
      const userNotCreated = new Error("Échec de création du compte invité.");
      try {
        return await db.transaction(async (tx) => {
          const [invitation] = await tx
            .update(schema.superAdminEditorInvitations)
            .set({ consumedAt: now })
            .where(and(
              eq(schema.superAdminEditorInvitations.tokenHash, tokenHash),
              isNull(schema.superAdminEditorInvitations.consumedAt),
              isNull(schema.superAdminEditorInvitations.revokedAt),
              gt(schema.superAdminEditorInvitations.expiresAt, now),
            ))
            .returning({
              id: schema.superAdminEditorInvitations.id,
              email: schema.superAdminEditorInvitations.email,
            });
          if (!invitation) return false;

          const [user] = await tx
            .insert(schema.users)
            .values({
              email: invitation.email,
              emailVerified: now,
              passwordHash,
              role: "super_admin_editor",
              universityId: null,
            })
            .onConflictDoNothing()
            .returning({ id: schema.users.id });
          if (!user) throw userNotCreated;

          const [accepted] = await tx
            .update(schema.superAdminEditorInvitations)
            .set({ acceptedUserId: user.id })
            .where(and(
              eq(schema.superAdminEditorInvitations.id, invitation.id),
              eq(schema.superAdminEditorInvitations.consumedAt, now),
            ))
            .returning({ id: schema.superAdminEditorInvitations.id });
          if (!accepted) throw new Error("Échec de consommation de l’invitation.");
          return true;
        });
      } catch (error) {
        if (error === userNotCreated) return false;
        throw error;
      }
    },
  },
});

export const createSuperAdminEditorInvitation = service.createSuperAdminEditorInvitation;
export const revokeSuperAdminEditorInvitation = service.revokeSuperAdminEditorInvitation;
export const consumeSuperAdminEditorInvitation = service.consumeSuperAdminEditorInvitation;
