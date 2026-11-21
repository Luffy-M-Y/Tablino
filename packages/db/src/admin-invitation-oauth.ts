import { createHash, randomBytes } from "node:crypto";
import {
  and,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  lte,
  sql,
} from "drizzle-orm";
import { db } from "./client";
import * as schema from "./schema";
import {
  hashAdminInvitationToken,
  isAdminInvitationRole,
  isValidInvitationToken,
  normalizeAdminInvitationEmail,
} from "./admin-invitation";

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const ADMIN_INVITATION_OAUTH_START_TICKET_TTL_MS = 5 * 60 * 1000;
export const ADMIN_INVITATION_OAUTH_TRANSACTION_TTL_MS = 15 * 60 * 1000;
export const ADMIN_INVITATION_OAUTH_TRANSFER_CODE_TTL_MS = 60 * 1000;

export type AdminInvitationOauthContext = {
  invitationId: string;
  transactionId: string;
};

export type AdminInvitationGoogleEligibility = {
  ok: boolean;
  pendingUserId: string | null;
};

export type AdminInvitationOauthRepository = {
  createStartTicket: (input: {
    invitationTokenHash: string;
    startTicketHash: string;
    expiresAt: Date;
    now: Date;
  }) => Promise<{ invitationId: string; transactionId: string } | null>;
  consumeStartTicket: (
    startTicketHash: string,
    now: Date,
    transactionExpiresAt: Date,
  ) => Promise<AdminInvitationOauthContext | null>;
  checkGoogleEligibility: (input: {
    invitationId: string;
    transactionId: string;
    email: string;
    now: Date;
  }) => Promise<AdminInvitationGoogleEligibility>;
  createPendingGoogleUser: (input: {
    invitationId: string;
    transactionId: string;
    email: string;
    name: string | null;
    image: string | null;
    now: Date;
  }) => Promise<string | null>;
  completeGoogleAccount: (input: {
    invitationId: string;
    transactionId: string;
    userId: string;
    providerAccountId: string;
    now: Date;
  }) => Promise<boolean>;
  createTransferCode: (input: {
    invitationId: string;
    transactionId: string;
    userId: string;
    transferCodeHash: string;
    transferExpiresAt: Date;
    now: Date;
  }) => Promise<boolean>;
  consumeTransferCode: (
    transferCodeHash: string,
    now: Date,
  ) => Promise<{ userId: string } | null>;
};

export type AdminInvitationOauthDependencies = {
  repository: AdminInvitationOauthRepository;
  now?: () => Date;
  randomBytes?: (size: number) => Buffer;
};

function hashOpaqueValue(value: string, purpose: "start" | "transfer"): string {
  return createHash("sha256").update(`${purpose}:${value}`).digest("hex");
}

function isValidOpaqueValue(value: unknown): value is string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(value)) return false;
  const bytes = Buffer.from(value, "base64url");
  return bytes.length === 32 && bytes.toString("base64url") === value;
}

function generateOpaqueValue(createRandomBytes: (size: number) => Buffer): string {
  const bytes = createRandomBytes(32);
  if (bytes.length !== 32) throw new Error("Génération d’un jeton OAuth invalide.");
  return bytes.toString("base64url");
}

async function cleanupExpiredOauthTransactions(transaction: DbTransaction, now: Date) {
  const expiredPendingUsers = await transaction
    .select({
      userId: schema.adminInvitationOauthTransactions.pendingUserId,
    })
    .from(schema.adminInvitationOauthTransactions)
    .innerJoin(
      schema.users,
      eq(
        schema.users.id,
        schema.adminInvitationOauthTransactions.pendingUserId,
      ),
    )
    .where(and(
      lte(schema.adminInvitationOauthTransactions.expiresAt, now),
      isNotNull(schema.adminInvitationOauthTransactions.pendingUserId),
      isNull(schema.users.emailVerified),
      isNull(schema.users.passwordHash),
      isNull(schema.users.revokedAt),
    ))
    .for("update");

  for (const expired of expiredPendingUsers) {
    if (expired.userId === null) continue;
    const activeTransactions = await transaction
      .select({ id: schema.adminInvitationOauthTransactions.id })
      .from(schema.adminInvitationOauthTransactions)
      .innerJoin(
        schema.adminInvitations,
        eq(
          schema.adminInvitations.id,
          schema.adminInvitationOauthTransactions.invitationId,
        ),
      )
      .where(and(
        eq(schema.adminInvitationOauthTransactions.pendingUserId, expired.userId),
        gt(schema.adminInvitationOauthTransactions.expiresAt, now),
        isNull(schema.adminInvitations.consumedAt),
        isNull(schema.adminInvitations.revokedAt),
        gt(schema.adminInvitations.expiresAt, now),
      ))
      .limit(1);
    const linkedAccounts = await transaction
      .select({ id: schema.accounts.id })
      .from(schema.accounts)
      .where(eq(schema.accounts.userId, expired.userId))
      .limit(1);
    if (activeTransactions.length === 0 && linkedAccounts.length === 0) {
      await transaction
        .delete(schema.users)
        .where(and(
          eq(schema.users.id, expired.userId),
          isNull(schema.users.emailVerified),
          isNull(schema.users.passwordHash),
          isNull(schema.users.revokedAt),
        ));
    }
  }

  await transaction
    .delete(schema.adminInvitationOauthTransactions)
    .where(lte(schema.adminInvitationOauthTransactions.expiresAt, now));
}

export function createAdminInvitationOauthService({
  repository,
  now = () => new Date(),
  randomBytes: createRandomBytes = randomBytes,
}: AdminInvitationOauthDependencies) {
  return {
    async createAdminInvitationOauthStartTicket(token: unknown): Promise<string | null> {
      if (!isValidInvitationToken(token)) return null;
      const createdAt = now();
      const ticket = generateOpaqueValue(createRandomBytes);
      const created = await repository.createStartTicket({
        invitationTokenHash: hashAdminInvitationToken(token),
        startTicketHash: hashOpaqueValue(ticket, "start"),
        expiresAt: new Date(createdAt.getTime() + ADMIN_INVITATION_OAUTH_START_TICKET_TTL_MS),
        now: createdAt,
      });
      return created ? ticket : null;
    },

    async consumeAdminInvitationOauthStartTicket(
      ticket: unknown,
    ): Promise<AdminInvitationOauthContext | null> {
      if (!isValidOpaqueValue(ticket)) return null;
      const consumedAt = now();
      return repository.consumeStartTicket(
        hashOpaqueValue(ticket, "start"),
        consumedAt,
        new Date(consumedAt.getTime() + ADMIN_INVITATION_OAUTH_TRANSACTION_TTL_MS),
      );
    },

    async checkAdminInvitationGoogleEligibility(input: {
      invitationId: string;
      transactionId: string;
      email: unknown;
    }): Promise<AdminInvitationGoogleEligibility> {
      const email = normalizeAdminInvitationEmail(input.email);
      if (!email || !input.invitationId || !input.transactionId) {
        return { ok: false, pendingUserId: null };
      }
      return repository.checkGoogleEligibility({
        invitationId: input.invitationId,
        transactionId: input.transactionId,
        email,
        now: now(),
      });
    },

    async createPendingAdminInvitationGoogleUser(input: {
      invitationId: string;
      transactionId: string;
      email: unknown;
      name: unknown;
      image: unknown;
    }): Promise<string | null> {
      const email = normalizeAdminInvitationEmail(input.email);
      if (!email || !input.invitationId || !input.transactionId) return null;
      return repository.createPendingGoogleUser({
        invitationId: input.invitationId,
        transactionId: input.transactionId,
        email,
        name: typeof input.name === "string" ? input.name.slice(0, 255) : null,
        image: typeof input.image === "string" ? input.image.slice(0, 500) : null,
        now: now(),
      });
    },

    async completeAdminInvitationGoogleAccount(input: {
      invitationId: string;
      transactionId: string;
      userId: string;
      provider: string;
      providerAccountId: string;
    }): Promise<boolean> {
      if (
        input.provider !== "google"
        || !input.invitationId
        || !input.transactionId
        || !input.userId
        || typeof input.providerAccountId !== "string"
        || input.providerAccountId.length === 0
        || input.providerAccountId.length > 255
      ) {
        return false;
      }
      return repository.completeGoogleAccount({
        invitationId: input.invitationId,
        transactionId: input.transactionId,
        userId: input.userId,
        providerAccountId: input.providerAccountId,
        now: now(),
      });
    },

    async createAdminInvitationOauthTransferCode(input: {
      invitationId: string;
      transactionId: string;
      userId: string;
    }): Promise<string | null> {
      if (!input.invitationId || !input.transactionId || !input.userId) return null;
      const createdAt = now();
      const code = generateOpaqueValue(createRandomBytes);
      const created = await repository.createTransferCode({
        ...input,
        transferCodeHash: hashOpaqueValue(code, "transfer"),
        transferExpiresAt: new Date(
          createdAt.getTime() + ADMIN_INVITATION_OAUTH_TRANSFER_CODE_TTL_MS,
        ),
        now: createdAt,
      });
      return created ? code : null;
    },

    async consumeAdminInvitationOauthTransferCode(
      code: unknown,
    ): Promise<{ userId: string } | null> {
      if (!isValidOpaqueValue(code)) return null;
      return repository.consumeTransferCode(hashOpaqueValue(code, "transfer"), now());
    },
  };
}

const service = createAdminInvitationOauthService({
  repository: {
    async createStartTicket({ invitationTokenHash, startTicketHash, expiresAt, now }) {
      return db.transaction(async (transaction) => {
        await cleanupExpiredOauthTransactions(transaction, now);
        const invitations = await transaction
          .select({
            id: schema.adminInvitations.id,
            role: schema.adminInvitations.role,
          })
          .from(schema.adminInvitations)
          .where(and(
            eq(schema.adminInvitations.tokenHash, invitationTokenHash),
            isNull(schema.adminInvitations.consumedAt),
            isNull(schema.adminInvitations.revokedAt),
            gt(schema.adminInvitations.expiresAt, now),
          ))
          .for("update")
          .limit(1);
        if (!(invitations.length > 0) || !isAdminInvitationRole(invitations[0].role)) {
          return null;
        }
        const rows = await transaction
          .insert(schema.adminInvitationOauthTransactions)
          .values({
            invitationId: invitations[0].id,
            startTicketHash,
            expiresAt,
          })
          .returning({
            invitationId: schema.adminInvitationOauthTransactions.invitationId,
            transactionId: schema.adminInvitationOauthTransactions.id,
          });
        return rows.length > 0 ? rows[0] : null;
      });
    },

    async consumeStartTicket(startTicketHash, now, transactionExpiresAt) {
      const rows = await db
        .update(schema.adminInvitationOauthTransactions)
        .set({
          startConsumedAt: now,
          expiresAt: transactionExpiresAt,
        })
        .where(and(
          eq(schema.adminInvitationOauthTransactions.startTicketHash, startTicketHash),
          isNull(schema.adminInvitationOauthTransactions.startConsumedAt),
          gt(schema.adminInvitationOauthTransactions.expiresAt, now),
        ))
        .returning({
          invitationId: schema.adminInvitationOauthTransactions.invitationId,
          transactionId: schema.adminInvitationOauthTransactions.id,
        });
      return rows.length > 0 ? rows[0] : null;
    },

    async checkGoogleEligibility({ invitationId, transactionId, email, now }) {
      return db.transaction(async (transaction) => {
        const transactions = await transaction
          .select({
            pendingUserId: schema.adminInvitationOauthTransactions.pendingUserId,
            invitationEmail: schema.adminInvitations.email,
            role: schema.adminInvitations.role,
          })
          .from(schema.adminInvitationOauthTransactions)
          .innerJoin(
            schema.adminInvitations,
            eq(
              schema.adminInvitations.id,
              schema.adminInvitationOauthTransactions.invitationId,
            ),
          )
          .where(and(
            eq(schema.adminInvitationOauthTransactions.id, transactionId),
            eq(schema.adminInvitationOauthTransactions.invitationId, invitationId),
            isNotNull(schema.adminInvitationOauthTransactions.startConsumedAt),
            isNull(schema.adminInvitationOauthTransactions.transferCodeHash),
            gt(schema.adminInvitationOauthTransactions.expiresAt, now),
            isNull(schema.adminInvitations.consumedAt),
            isNull(schema.adminInvitations.revokedAt),
            gt(schema.adminInvitations.expiresAt, now),
          ))
          .for("update")
          .limit(1);
        if (
          !(transactions.length > 0)
          || !isAdminInvitationRole(transactions[0].role)
          || transactions[0].invitationEmail !== email
        ) {
          return { ok: false, pendingUserId: null };
        }

        let pendingUserId = transactions[0].pendingUserId;
        if (pendingUserId === null) {
          const otherPendingUsers = await transaction
            .select({
              pendingUserId: schema.adminInvitationOauthTransactions.pendingUserId,
            })
            .from(schema.adminInvitationOauthTransactions)
            .innerJoin(
              schema.users,
              eq(
                schema.users.id,
                schema.adminInvitationOauthTransactions.pendingUserId,
              ),
            )
            .where(and(
              eq(schema.adminInvitationOauthTransactions.invitationId, invitationId),
              isNotNull(schema.adminInvitationOauthTransactions.pendingUserId),
              gt(schema.adminInvitationOauthTransactions.expiresAt, now),
              eq(schema.users.email, email),
              eq(schema.users.role, transactions[0].role),
              isNull(schema.users.universityId),
              isNull(schema.users.emailVerified),
              isNull(schema.users.passwordHash),
              isNull(schema.users.revokedAt),
            ))
            .limit(1);
          pendingUserId = otherPendingUsers[0]?.pendingUserId ?? null;
          if (pendingUserId !== null) {
            await transaction
              .update(schema.adminInvitationOauthTransactions)
              .set({ pendingUserId })
              .where(and(
                eq(schema.adminInvitationOauthTransactions.id, transactionId),
                isNull(schema.adminInvitationOauthTransactions.pendingUserId),
              ));
          }
        }
        if (pendingUserId === null) return { ok: true, pendingUserId: null };

        const users = await transaction
          .select({
            email: schema.users.email,
            role: schema.users.role,
            universityId: schema.users.universityId,
            emailVerified: schema.users.emailVerified,
            passwordHash: schema.users.passwordHash,
            revokedAt: schema.users.revokedAt,
          })
          .from(schema.users)
          .where(eq(schema.users.id, pendingUserId))
          .limit(1);
        const user = users[0];
        if (
          !user
          || user.email !== email
          || user.role !== transactions[0].role
          || user.universityId !== null
          || user.emailVerified !== null
          || user.passwordHash !== null
          || user.revokedAt !== null
        ) {
          return { ok: false, pendingUserId: null };
        }
        return { ok: true, pendingUserId };
      });
    },

    async createPendingGoogleUser({ invitationId, transactionId, email, name, image, now }) {
      return db.transaction(async (transaction) => {
        const tickets = await transaction
          .select({
            pendingUserId: schema.adminInvitationOauthTransactions.pendingUserId,
          })
          .from(schema.adminInvitationOauthTransactions)
          .where(and(
            eq(schema.adminInvitationOauthTransactions.id, transactionId),
            eq(schema.adminInvitationOauthTransactions.invitationId, invitationId),
            isNull(schema.adminInvitationOauthTransactions.transferCodeHash),
            gt(schema.adminInvitationOauthTransactions.expiresAt, now),
            isNotNull(schema.adminInvitationOauthTransactions.startConsumedAt),
          ))
          .for("update")
          .limit(1);
        if (!(tickets.length > 0)) return null;

        const invitations = await transaction
          .select({
            id: schema.adminInvitations.id,
            email: schema.adminInvitations.email,
            role: schema.adminInvitations.role,
          })
          .from(schema.adminInvitations)
          .where(and(
            eq(schema.adminInvitations.id, invitationId),
            isNull(schema.adminInvitations.consumedAt),
            isNull(schema.adminInvitations.revokedAt),
            gt(schema.adminInvitations.expiresAt, now),
          ))
          .for("update")
          .limit(1);
        if (
          !(invitations.length > 0)
          || !isAdminInvitationRole(invitations[0].role)
          || invitations[0].email !== email
        ) {
          return null;
        }

        const pendingUserId = tickets[0].pendingUserId;
        if (pendingUserId !== null) {
          const users = await transaction
            .select({
              id: schema.users.id,
              email: schema.users.email,
              role: schema.users.role,
              universityId: schema.users.universityId,
              emailVerified: schema.users.emailVerified,
              passwordHash: schema.users.passwordHash,
              revokedAt: schema.users.revokedAt,
            })
            .from(schema.users)
            .where(eq(schema.users.id, pendingUserId))
            .limit(1);
          const user = users[0];
          const linkedAccounts = await transaction
            .select({ id: schema.accounts.id })
            .from(schema.accounts)
            .where(eq(schema.accounts.userId, pendingUserId))
            .limit(1);
          return user
            && user.email === email
            && user.role === invitations[0].role
            && user.universityId === null
            && user.emailVerified === null
            && user.passwordHash === null
            && user.revokedAt === null
            && linkedAccounts.length === 0
            ? user.id
            : null;
        }

        const existingUsers = await transaction
          .select({ id: schema.users.id })
          .from(schema.users)
          .where(sql`lower(${schema.users.email}) = ${email}`)
          .limit(1);
        if (existingUsers.length > 0) return null;

        const users = await transaction
          .insert(schema.users)
          .values({
            email,
            name,
            image,
            emailVerified: null,
            passwordHash: null,
            role: invitations[0].role,
            universityId: null,
          })
          .onConflictDoNothing()
          .returning({ id: schema.users.id });
        if (!(users.length > 0)) return null;
        const updated = await transaction
          .update(schema.adminInvitationOauthTransactions)
          .set({ pendingUserId: users[0].id })
          .where(and(
            eq(schema.adminInvitationOauthTransactions.id, transactionId),
            isNull(schema.adminInvitationOauthTransactions.pendingUserId),
          ))
          .returning({ id: schema.adminInvitationOauthTransactions.id });
        if (updated.length > 0) return users[0].id;
        await transaction
          .delete(schema.users)
          .where(and(
            eq(schema.users.id, users[0].id),
            isNull(schema.users.emailVerified),
            isNull(schema.users.passwordHash),
            isNull(schema.users.revokedAt),
          ));
        return null;
      });
    },

    async completeGoogleAccount({
      invitationId,
      transactionId,
      userId,
      providerAccountId,
      now,
    }) {
      const rollback = new Error("Invitation Google finalization failed.");
      try {
        return await db.transaction(async (transaction) => {
          const transactions = await transaction
            .select({
              pendingUserId: schema.adminInvitationOauthTransactions.pendingUserId,
            })
            .from(schema.adminInvitationOauthTransactions)
            .where(and(
              eq(schema.adminInvitationOauthTransactions.id, transactionId),
              eq(schema.adminInvitationOauthTransactions.invitationId, invitationId),
              gt(schema.adminInvitationOauthTransactions.expiresAt, now),
              isNull(schema.adminInvitationOauthTransactions.transferCodeHash),
              isNotNull(schema.adminInvitationOauthTransactions.startConsumedAt),
            ))
            .for("update")
            .limit(1);
          const oauthTransaction = transactions[0];
          if (!oauthTransaction || oauthTransaction.pendingUserId !== userId) return false;

          const invitations = await transaction
            .select({
              email: schema.adminInvitations.email,
              role: schema.adminInvitations.role,
            })
            .from(schema.adminInvitations)
            .where(and(
              eq(schema.adminInvitations.id, invitationId),
              isNull(schema.adminInvitations.consumedAt),
              isNull(schema.adminInvitations.revokedAt),
              gt(schema.adminInvitations.expiresAt, now),
            ))
            .for("update")
            .limit(1);
          if (
            !(invitations.length > 0)
            || !isAdminInvitationRole(invitations[0].role)
          ) {
            await deletePendingUser(transaction, transactionId, userId);
            return false;
          }

          const users = await transaction
            .select({
              email: schema.users.email,
              role: schema.users.role,
              universityId: schema.users.universityId,
              emailVerified: schema.users.emailVerified,
              passwordHash: schema.users.passwordHash,
              revokedAt: schema.users.revokedAt,
            })
            .from(schema.users)
            .where(eq(schema.users.id, userId))
            .for("update")
            .limit(1);
          const user = users[0];
          if (
            !user
            || user.email !== invitations[0].email
            || user.role !== invitations[0].role
            || user.universityId !== null
            || user.emailVerified !== null
            || user.passwordHash !== null
            || user.revokedAt !== null
          ) {
            await deletePendingUser(transaction, transactionId, userId);
            return false;
          }

          const linked = await transaction
            .insert(schema.accounts)
            .values({
              userId,
              type: "oauth",
              provider: "google",
              providerAccountId,
            })
            .onConflictDoNothing({
              target: [schema.accounts.provider, schema.accounts.providerAccountId],
            })
            .returning({ id: schema.accounts.id });
          if (!(linked.length > 0)) {
            await deletePendingUser(transaction, transactionId, userId);
            return false;
          }

          const accepted = await transaction
            .update(schema.adminInvitations)
            .set({ consumedAt: now, acceptedUserId: userId })
            .where(and(
              eq(schema.adminInvitations.id, invitationId),
              isNull(schema.adminInvitations.consumedAt),
              isNull(schema.adminInvitations.revokedAt),
              gt(schema.adminInvitations.expiresAt, now),
            ))
            .returning({ id: schema.adminInvitations.id });
          if (!(accepted.length > 0)) throw rollback;

          const verified = await transaction
            .update(schema.users)
            .set({ emailVerified: now })
            .where(and(
              eq(schema.users.id, userId),
              isNull(schema.users.emailVerified),
              isNull(schema.users.passwordHash),
              isNull(schema.users.revokedAt),
            ))
            .returning({ id: schema.users.id });
          if (!(verified.length > 0)) throw rollback;
          return true;
        });
      } catch (error) {
        if (error === rollback) return false;
        throw error;
      }
    },

    async createTransferCode({
      invitationId,
      transactionId,
      userId,
      transferCodeHash,
      transferExpiresAt,
      now,
    }) {
      return db.transaction(async (transaction) => {
        const accepted = await transaction
          .select({
            role: schema.adminInvitations.role,
            userRole: schema.users.role,
          })
          .from(schema.adminInvitations)
          .innerJoin(
            schema.users,
            eq(schema.users.id, schema.adminInvitations.acceptedUserId),
          )
          .where(and(
            eq(schema.adminInvitations.id, invitationId),
            eq(schema.adminInvitations.acceptedUserId, userId),
            isNotNull(schema.adminInvitations.consumedAt),
            isNull(schema.adminInvitations.revokedAt),
            isNull(schema.users.revokedAt),
            isNotNull(schema.users.emailVerified),
            isNull(schema.users.universityId),
          ))
          .limit(1);
        if (
          !(accepted.length > 0)
          || !isAdminInvitationRole(accepted[0].role)
          || accepted[0].userRole !== accepted[0].role
        ) {
          return false;
        }
        const rows = await transaction
          .update(schema.adminInvitationOauthTransactions)
          .set({ transferCodeHash, transferExpiresAt })
          .where(and(
            eq(schema.adminInvitationOauthTransactions.id, transactionId),
            eq(schema.adminInvitationOauthTransactions.invitationId, invitationId),
            eq(schema.adminInvitationOauthTransactions.pendingUserId, userId),
            isNull(schema.adminInvitationOauthTransactions.transferCodeHash),
            gt(schema.adminInvitationOauthTransactions.expiresAt, now),
            isNotNull(schema.adminInvitationOauthTransactions.startConsumedAt),
          ))
          .returning({ id: schema.adminInvitationOauthTransactions.id });
        return rows.length > 0;
      });
    },

    async consumeTransferCode(transferCodeHash, now) {
      return db.transaction(async (transaction) => {
        const transactions = await transaction
          .select({
            id: schema.adminInvitationOauthTransactions.id,
            invitationId: schema.adminInvitationOauthTransactions.invitationId,
            pendingUserId: schema.adminInvitationOauthTransactions.pendingUserId,
          })
          .from(schema.adminInvitationOauthTransactions)
          .where(and(
            eq(schema.adminInvitationOauthTransactions.transferCodeHash, transferCodeHash),
            isNull(schema.adminInvitationOauthTransactions.transferConsumedAt),
            gt(schema.adminInvitationOauthTransactions.transferExpiresAt, now),
          ))
          .for("update")
          .limit(1);
        if (!(transactions.length > 0) || transactions[0].pendingUserId === null) return null;
        const oauthTransaction = transactions[0];
        const pendingUserId = oauthTransaction.pendingUserId;
        if (pendingUserId === null) return null;
        const accepted = await transaction
          .select({
            role: schema.adminInvitations.role,
            userRole: schema.users.role,
            emailVerified: schema.users.emailVerified,
          })
          .from(schema.adminInvitations)
          .innerJoin(
            schema.users,
            eq(schema.users.id, schema.adminInvitations.acceptedUserId),
          )
          .where(and(
            eq(schema.adminInvitations.id, oauthTransaction.invitationId),
            eq(schema.adminInvitations.acceptedUserId, pendingUserId),
            isNotNull(schema.adminInvitations.consumedAt),
            isNull(schema.adminInvitations.revokedAt),
            isNull(schema.users.revokedAt),
            isNull(schema.users.universityId),
            isNotNull(schema.users.emailVerified),
          ))
          .limit(1);
        if (
          !(accepted.length > 0)
          || !isAdminInvitationRole(accepted[0].role)
          || accepted[0].userRole !== accepted[0].role
          || accepted[0].emailVerified === null
        ) {
          return null;
        }

        const consumed = await transaction
          .update(schema.adminInvitationOauthTransactions)
          .set({ transferConsumedAt: now })
          .where(and(
            eq(schema.adminInvitationOauthTransactions.id, oauthTransaction.id),
            isNull(schema.adminInvitationOauthTransactions.transferConsumedAt),
            gt(schema.adminInvitationOauthTransactions.transferExpiresAt, now),
          ))
          .returning({ id: schema.adminInvitationOauthTransactions.id });
        return consumed.length > 0 ? { userId: pendingUserId } : null;
      });
    },
  },
});

async function deletePendingUser(
  transaction: DbTransaction,
  transactionId: string,
  userId: string,
) {
  const accounts = await transaction
    .select({ id: schema.accounts.id })
    .from(schema.accounts)
    .where(eq(schema.accounts.userId, userId))
    .limit(1);
  if (accounts.length > 0) return;
  const rows = await transaction
    .select({
      emailVerified: schema.users.emailVerified,
      passwordHash: schema.users.passwordHash,
    })
    .from(schema.users)
    .innerJoin(
      schema.adminInvitationOauthTransactions,
      and(
        eq(schema.adminInvitationOauthTransactions.pendingUserId, schema.users.id),
        eq(schema.adminInvitationOauthTransactions.id, transactionId),
      ),
    )
    .where(eq(schema.users.id, userId))
    .limit(1);
  if (!(rows.length > 0) || rows[0].emailVerified !== null || rows[0].passwordHash !== null) return;
  await transaction.delete(schema.users).where(eq(schema.users.id, userId));
}

export const createAdminInvitationOauthStartTicket =
  service.createAdminInvitationOauthStartTicket;
export const consumeAdminInvitationOauthStartTicket =
  service.consumeAdminInvitationOauthStartTicket;
export const checkAdminInvitationGoogleEligibility =
  service.checkAdminInvitationGoogleEligibility;
export const createPendingAdminInvitationGoogleUser =
  service.createPendingAdminInvitationGoogleUser;
export const completeAdminInvitationGoogleAccount =
  service.completeAdminInvitationGoogleAccount;
export const createAdminInvitationOauthTransferCode =
  service.createAdminInvitationOauthTransferCode;
export const consumeAdminInvitationOauthTransferCode =
  service.consumeAdminInvitationOauthTransferCode;
