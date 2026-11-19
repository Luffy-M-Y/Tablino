import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, inArray, isNotNull, isNull, lte, sql } from "drizzle-orm";
import { db } from "./client";
import * as schema from "./schema";
import { normalizeAdminInvitationEmail } from "./admin-invitation";

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const ADMIN_SUPER_LOGIN_OAUTH_START_TICKET_TTL_MS = 5 * 60 * 1000;
export const ADMIN_SUPER_LOGIN_OAUTH_TRANSACTION_TTL_MS = 15 * 60 * 1000;
export const ADMIN_SUPER_LOGIN_OAUTH_TRANSFER_CODE_TTL_MS = 60 * 1000;

export type AdminSuperLoginOauthContext = {
  transactionId: string;
};

export type AdminSuperLoginGoogleEligibility = {
  ok: boolean;
  userId: string | null;
};

export type AdminSuperLoginOauthRepository = {
  createStartTicket: (input: {
    startTicketHash: string;
    expiresAt: Date;
    now: Date;
  }) => Promise<{ transactionId: string } | null>;
  consumeStartTicket: (
    startTicketHash: string,
    now: Date,
    transactionExpiresAt: Date,
  ) => Promise<AdminSuperLoginOauthContext | null>;
  checkGoogleEligibility: (input: {
    transactionId: string;
    email: string;
    providerAccountId: string;
    now: Date;
  }) => Promise<AdminSuperLoginGoogleEligibility>;
  createTransferCode: (input: {
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

export type AdminSuperLoginOauthDependencies = {
  repository: AdminSuperLoginOauthRepository;
  now?: () => Date;
  randomBytes?: (size: number) => Buffer;
};

function hashOpaqueValue(value: string, purpose: "start" | "transfer"): string {
  return createHash("sha256").update(`super-login:${purpose}:${value}`).digest("hex");
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

export function createAdminSuperLoginOauthService({
  repository,
  now = () => new Date(),
  randomBytes: createRandomBytes = randomBytes,
}: AdminSuperLoginOauthDependencies) {
  return {
    async createAdminSuperLoginOauthStartTicket(): Promise<string | null> {
      const createdAt = now();
      const ticket = generateOpaqueValue(createRandomBytes);
      const created = await repository.createStartTicket({
        startTicketHash: hashOpaqueValue(ticket, "start"),
        expiresAt: new Date(
          createdAt.getTime() + ADMIN_SUPER_LOGIN_OAUTH_START_TICKET_TTL_MS,
        ),
        now: createdAt,
      });
      return created ? ticket : null;
    },

    async consumeAdminSuperLoginOauthStartTicket(
      ticket: unknown,
    ): Promise<AdminSuperLoginOauthContext | null> {
      if (!isValidOpaqueValue(ticket)) return null;
      const consumedAt = now();
      return repository.consumeStartTicket(
        hashOpaqueValue(ticket, "start"),
        consumedAt,
        new Date(consumedAt.getTime() + ADMIN_SUPER_LOGIN_OAUTH_TRANSACTION_TTL_MS),
      );
    },

    async checkAdminSuperLoginGoogleEligibility(input: {
      transactionId: string;
      email: unknown;
      providerAccountId: unknown;
    }): Promise<AdminSuperLoginGoogleEligibility> {
      const email = normalizeAdminInvitationEmail(input.email);
      if (
        !email
        || !input.transactionId
        || typeof input.providerAccountId !== "string"
        || input.providerAccountId.length === 0
        || input.providerAccountId.length > 255
      ) {
        return { ok: false, userId: null };
      }
      return repository.checkGoogleEligibility({
        transactionId: input.transactionId,
        email,
        providerAccountId: input.providerAccountId,
        now: now(),
      });
    },

    async createAdminSuperLoginOauthTransferCode(input: {
      transactionId: string;
      userId: string;
    }): Promise<string | null> {
      if (!input.transactionId || !input.userId) return null;
      const createdAt = now();
      const code = generateOpaqueValue(createRandomBytes);
      const created = await repository.createTransferCode({
        ...input,
        transferCodeHash: hashOpaqueValue(code, "transfer"),
        transferExpiresAt: new Date(
          createdAt.getTime() + ADMIN_SUPER_LOGIN_OAUTH_TRANSFER_CODE_TTL_MS,
        ),
        now: createdAt,
      });
      return created ? code : null;
    },

    async consumeAdminSuperLoginOauthTransferCode(
      code: unknown,
    ): Promise<{ userId: string } | null> {
      if (!isValidOpaqueValue(code)) return null;
      return repository.consumeTransferCode(hashOpaqueValue(code, "transfer"), now());
    },
  };
}

const service = createAdminSuperLoginOauthService({
  repository: {
    async createStartTicket({ startTicketHash, expiresAt, now }) {
      return db.transaction(async (transaction) => {
        await transaction
          .delete(schema.adminSuperLoginOauthTransactions)
          .where(lte(schema.adminSuperLoginOauthTransactions.expiresAt, now));
        const rows = await transaction
          .insert(schema.adminSuperLoginOauthTransactions)
          .values({ startTicketHash, expiresAt })
          .returning({ transactionId: schema.adminSuperLoginOauthTransactions.id });
        return rows.length > 0 ? rows[0] : null;
      });
    },

    async consumeStartTicket(startTicketHash, now, transactionExpiresAt) {
      const rows = await db
        .update(schema.adminSuperLoginOauthTransactions)
        .set({
          startConsumedAt: now,
          expiresAt: transactionExpiresAt,
        })
        .where(and(
          eq(schema.adminSuperLoginOauthTransactions.startTicketHash, startTicketHash),
          isNull(schema.adminSuperLoginOauthTransactions.startConsumedAt),
          gt(schema.adminSuperLoginOauthTransactions.expiresAt, now),
        ))
        .returning({ transactionId: schema.adminSuperLoginOauthTransactions.id });
      return rows.length > 0 ? rows[0] : null;
    },

    async checkGoogleEligibility({ transactionId, email, providerAccountId, now }) {
      return db.transaction(async (transaction) => {
        const rows = await transaction
          .select({
            transactionUserId: schema.adminSuperLoginOauthTransactions.userId,
            userId: schema.users.id,
          })
          .from(schema.adminSuperLoginOauthTransactions)
          .innerJoin(
            schema.accounts,
            and(
              eq(schema.accounts.provider, "google"),
              eq(schema.accounts.providerAccountId, providerAccountId),
            ),
          )
          .innerJoin(schema.users, eq(schema.users.id, schema.accounts.userId))
          .innerJoin(
            schema.adminInvitations,
            eq(schema.adminInvitations.acceptedUserId, schema.users.id),
          )
          .where(and(
            eq(schema.adminSuperLoginOauthTransactions.id, transactionId),
            isNotNull(schema.adminSuperLoginOauthTransactions.startConsumedAt),
            isNull(schema.adminSuperLoginOauthTransactions.transferCodeHash),
            gt(schema.adminSuperLoginOauthTransactions.expiresAt, now),
            eq(schema.accounts.provider, "google"),
            eq(schema.accounts.providerAccountId, providerAccountId),
            eq(sql`lower(${schema.users.email})`, email),
            eq(schema.adminInvitations.email, email),
            eq(schema.users.email, schema.adminInvitations.email),
            isNotNull(schema.adminInvitations.consumedAt),
            isNull(schema.adminInvitations.revokedAt),
            inArray(schema.adminInvitations.role, [
              "super_admin_editor",
              "super_admin_lector",
            ]),
            eq(schema.users.role, schema.adminInvitations.role),
            isNull(schema.users.universityId),
            isNull(schema.users.revokedAt),
            isNotNull(schema.users.emailVerified),
          ))
          .for("update")
          .limit(1);
        if (!(rows.length > 0)) return { ok: false, userId: null };

        const userId = rows[0].userId;
        if (
          rows[0].transactionUserId !== null
          && rows[0].transactionUserId !== userId
        ) {
          return { ok: false, userId: null };
        }
        if (rows[0].transactionUserId === null) {
          const bound = await transaction
            .update(schema.adminSuperLoginOauthTransactions)
            .set({ userId })
            .where(and(
              eq(schema.adminSuperLoginOauthTransactions.id, transactionId),
              isNull(schema.adminSuperLoginOauthTransactions.userId),
              isNull(schema.adminSuperLoginOauthTransactions.transferCodeHash),
              gt(schema.adminSuperLoginOauthTransactions.expiresAt, now),
            ))
            .returning({ id: schema.adminSuperLoginOauthTransactions.id });
          if (!(bound.length > 0)) return { ok: false, userId: null };
        }
        return { ok: true, userId };
      });
    },

    async createTransferCode({
      transactionId,
      userId,
      transferCodeHash,
      transferExpiresAt,
      now,
    }) {
      return db.transaction(async (transaction) => {
        const eligibleUsers = await transaction
          .select({ id: schema.users.id })
          .from(schema.users)
          .innerJoin(
            schema.adminInvitations,
            eq(schema.adminInvitations.acceptedUserId, schema.users.id),
          )
          .innerJoin(
            schema.accounts,
            eq(schema.accounts.userId, schema.users.id),
          )
          .innerJoin(
            schema.adminSuperLoginOauthTransactions,
            eq(schema.adminSuperLoginOauthTransactions.userId, schema.users.id),
          )
          .where(and(
            eq(schema.adminSuperLoginOauthTransactions.id, transactionId),
            eq(schema.adminSuperLoginOauthTransactions.userId, userId),
            isNotNull(schema.adminSuperLoginOauthTransactions.startConsumedAt),
            isNull(schema.adminSuperLoginOauthTransactions.transferCodeHash),
            gt(schema.adminSuperLoginOauthTransactions.expiresAt, now),
            isNotNull(schema.adminInvitations.consumedAt),
            isNull(schema.adminInvitations.revokedAt),
            inArray(schema.adminInvitations.role, [
              "super_admin_editor",
              "super_admin_lector",
            ]),
            eq(schema.users.role, schema.adminInvitations.role),
            isNull(schema.users.universityId),
            isNull(schema.users.revokedAt),
            isNotNull(schema.users.emailVerified),
            eq(schema.accounts.provider, "google"),
          ))
          .for("update")
          .limit(1);
        if (!(eligibleUsers.length > 0)) return false;

        const rows = await transaction
          .update(schema.adminSuperLoginOauthTransactions)
          .set({ transferCodeHash, transferExpiresAt })
          .where(and(
            eq(schema.adminSuperLoginOauthTransactions.id, transactionId),
            eq(schema.adminSuperLoginOauthTransactions.userId, userId),
            isNull(schema.adminSuperLoginOauthTransactions.transferCodeHash),
            gt(schema.adminSuperLoginOauthTransactions.expiresAt, now),
          ))
          .returning({ id: schema.adminSuperLoginOauthTransactions.id });
        return rows.length > 0;
      });
    },

    async consumeTransferCode(transferCodeHash, now) {
      return db.transaction(async (transaction) => {
        const rows = await transaction
          .select({
            transactionId: schema.adminSuperLoginOauthTransactions.id,
            userId: schema.adminSuperLoginOauthTransactions.userId,
          })
          .from(schema.adminSuperLoginOauthTransactions)
          .innerJoin(
            schema.users,
            eq(schema.users.id, schema.adminSuperLoginOauthTransactions.userId),
          )
          .innerJoin(
            schema.adminInvitations,
            eq(schema.adminInvitations.acceptedUserId, schema.users.id),
          )
          .innerJoin(
            schema.accounts,
            eq(schema.accounts.userId, schema.users.id),
          )
          .where(and(
            eq(schema.adminSuperLoginOauthTransactions.transferCodeHash, transferCodeHash),
            isNull(schema.adminSuperLoginOauthTransactions.transferConsumedAt),
            gt(schema.adminSuperLoginOauthTransactions.transferExpiresAt, now),
            isNotNull(schema.adminInvitations.consumedAt),
            isNull(schema.adminInvitations.revokedAt),
            inArray(schema.adminInvitations.role, [
              "super_admin_editor",
              "super_admin_lector",
            ]),
            eq(schema.users.role, schema.adminInvitations.role),
            isNull(schema.users.universityId),
            isNull(schema.users.revokedAt),
            isNotNull(schema.users.emailVerified),
            eq(schema.accounts.provider, "google"),
          ))
          .for("update")
          .limit(1);
        if (!(rows.length > 0) || rows[0].userId === null) return null;

        const consumed = await transaction
          .update(schema.adminSuperLoginOauthTransactions)
          .set({ transferConsumedAt: now })
          .where(and(
            eq(schema.adminSuperLoginOauthTransactions.id, rows[0].transactionId),
            isNull(schema.adminSuperLoginOauthTransactions.transferConsumedAt),
            gt(schema.adminSuperLoginOauthTransactions.transferExpiresAt, now),
          ))
          .returning({ id: schema.adminSuperLoginOauthTransactions.id });
        return consumed.length > 0 ? { userId: rows[0].userId } : null;
      });
    },
  },
});

export const createAdminSuperLoginOauthStartTicket =
  service.createAdminSuperLoginOauthStartTicket;
export const consumeAdminSuperLoginOauthStartTicket =
  service.consumeAdminSuperLoginOauthStartTicket;
export const checkAdminSuperLoginGoogleEligibility =
  service.checkAdminSuperLoginGoogleEligibility;
export const createAdminSuperLoginOauthTransferCode =
  service.createAdminSuperLoginOauthTransferCode;
export const consumeAdminSuperLoginOauthTransferCode =
  service.consumeAdminSuperLoginOauthTransferCode;
