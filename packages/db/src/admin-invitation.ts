import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { db } from "./client";
import * as schema from "./schema";
import { hashPassword as hashUserPassword, isPasswordValid } from "./password";

export const ADMIN_INVITATION_TTL_MS = 48 * 60 * 60 * 1000;

export type AdminInvitationRole = "super_admin_editor" | "super_admin_lector";

type CreatedInvitation = {
  invitationId: string;
  role: AdminInvitationRole;
};

export type AdminInvitationRepository = {
  create: (input: {
    email: string;
    invitedByUserId: string;
    tokenHash: string;
    role: AdminInvitationRole;
    createdAt: Date;
    expiresAt: Date;
  }) => Promise<CreatedInvitation | "account_exists" | "inviter_not_allowed">;
  revoke: (invitationId: string, revokedAt: Date) => Promise<boolean>;
  consume: (input: {
    tokenHash: string;
    passwordHash: string;
    now: Date;
  }) => Promise<AdminInvitationRole | null>;
};

export type AdminInvitationDependencies = {
  repository: AdminInvitationRepository;
  now?: () => Date;
  randomBytes?: (size: number) => Buffer;
  hashPassword?: (password: string) => string;
  isPasswordValid?: (password: unknown) => password is string;
};

export type CreateAdminInvitationResult =
  | {
      ok: true;
      invitationId: string;
      email: string;
      role: AdminInvitationRole;
      token: string;
      expiresAt: Date;
    }
  | {
      ok: false;
      reason: "invalid_email" | "account_exists" | "inviter_not_allowed";
    };

export type ConsumeAdminInvitationResult =
  | { ok: true; role: AdminInvitationRole }
  | { ok: false; reason: "invalid_password" | "invitation_unavailable" };

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

function isValidInvitationToken(token: unknown): token is string {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token)) return false;
  const bytes = Buffer.from(token, "base64url");
  return bytes.length === 32 && bytes.toString("base64url") === token;
}

export function createAdminInvitationService({
  repository,
  now = () => new Date(),
  randomBytes: createRandomBytes = randomBytes,
  hashPassword = hashUserPassword,
  isPasswordValid: validatePassword = isPasswordValid,
}: AdminInvitationDependencies) {
  return {
    async createAdminInvitation(
      emailInput: unknown,
      invitedByUserId: string,
    ): Promise<CreateAdminInvitationResult> {
      const email = normalizeAdminInvitationEmail(emailInput);
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
        tokenHash: hashAdminInvitationToken(token),
        role: "super_admin_lector",
        createdAt,
        expiresAt: new Date(createdAt.getTime() + ADMIN_INVITATION_TTL_MS),
      });
      if (result === "account_exists") return { ok: false, reason: "account_exists" };
      if (result === "inviter_not_allowed") return { ok: false, reason: "inviter_not_allowed" };

      return {
        ok: true,
        invitationId: result.invitationId,
        email,
        role: result.role,
        token,
        expiresAt: new Date(createdAt.getTime() + ADMIN_INVITATION_TTL_MS),
      };
    },

    async revokeAdminInvitation(invitationId: string): Promise<boolean> {
      return repository.revoke(invitationId, now());
    },

    async consumeAdminInvitation(
      token: unknown,
      password: unknown,
    ): Promise<ConsumeAdminInvitationResult> {
      if (!validatePassword(password)) return { ok: false, reason: "invalid_password" };
      if (!isValidInvitationToken(token)) {
        return { ok: false, reason: "invitation_unavailable" };
      }

      const role = await repository.consume({
        tokenHash: hashAdminInvitationToken(token),
        passwordHash: hashPassword(password),
        now: now(),
      });
      return role === null
        ? { ok: false, reason: "invitation_unavailable" }
        : { ok: true, role };
    },
  };
}

const service = createAdminInvitationService({
  repository: {
    async create({ email, invitedByUserId, tokenHash, role, createdAt, expiresAt }) {
      return db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${email}))`);

        const [inviter] = await tx
          .select({ id: schema.users.id, role: schema.users.role })
          .from(schema.users)
          .where(and(
            eq(schema.users.id, invitedByUserId),
            inArray(schema.users.role, ["super_admin", "super_admin_editor"]),
            isNull(schema.users.revokedAt),
          ))
          .for("share")
          .limit(1);
        if (
          !inviter
          || (role === "super_admin_editor" && inviter.role !== "super_admin")
        ) {
          return "inviter_not_allowed";
        }

        const [existingUser] = await tx
          .select({ id: schema.users.id })
          .from(schema.users)
          .where(sql`lower(${schema.users.email}) = ${email}`)
          .limit(1);
        if (existingUser) return "account_exists";

        await tx
          .update(schema.adminInvitations)
          .set({ revokedAt: createdAt })
          .where(and(
            sql`lower(${schema.adminInvitations.email}) = ${email}`,
            isNull(schema.adminInvitations.consumedAt),
            isNull(schema.adminInvitations.revokedAt),
          ));

        const [invitation] = await tx
          .insert(schema.adminInvitations)
          .values({ email, invitedByUserId, tokenHash, role, createdAt, expiresAt })
          .returning({
            id: schema.adminInvitations.id,
            role: schema.adminInvitations.role,
          });
        if (!invitation || !isAdminInvitationRole(invitation.role)) {
          throw new Error("Échec de création de l’invitation.");
        }
        return { invitationId: invitation.id, role: invitation.role };
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

    async consume({ tokenHash, passwordHash, now }) {
      const userNotCreated = new Error("Échec de création du compte invité.");
      try {
        return await db.transaction(async (tx) => {
          const [invitation] = await tx
            .update(schema.adminInvitations)
            .set({ consumedAt: now })
            .where(and(
              eq(schema.adminInvitations.tokenHash, tokenHash),
              isNull(schema.adminInvitations.consumedAt),
              isNull(schema.adminInvitations.revokedAt),
              gt(schema.adminInvitations.expiresAt, now),
            ))
            .returning({
              id: schema.adminInvitations.id,
              email: schema.adminInvitations.email,
              role: schema.adminInvitations.role,
            });
          if (!invitation) return null;
          if (!isAdminInvitationRole(invitation.role)) {
            throw new Error("Rôle d’invitation invalide.");
          }

          const [user] = await tx
            .insert(schema.users)
            .values({
              email: invitation.email,
              emailVerified: now,
              passwordHash,
              role: invitation.role,
              universityId: null,
            })
            .onConflictDoNothing()
            .returning({ id: schema.users.id });
          if (!user) throw userNotCreated;

          const [accepted] = await tx
            .update(schema.adminInvitations)
            .set({ acceptedUserId: user.id })
            .where(and(
              eq(schema.adminInvitations.id, invitation.id),
              eq(schema.adminInvitations.consumedAt, now),
            ))
            .returning({ id: schema.adminInvitations.id });
          if (!accepted) throw new Error("Échec de consommation de l’invitation.");
          return invitation.role;
        });
      } catch (error) {
        if (error === userNotCreated) return null;
        throw error;
      }
    },
  },
});

export const createAdminInvitation = service.createAdminInvitation;
export const revokeAdminInvitation = service.revokeAdminInvitation;
export const consumeAdminInvitation = service.consumeAdminInvitation;
