import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import type { db as sharedDb } from "./client";
import * as schema from "./schema";
import { checkRateLimit, recordFailure } from "./auth-attempts";
import { verifyPassword as verifyStoredPassword } from "./password";

type RevocationDatabase = typeof sharedDb;

async function resolveDatabase(database?: RevocationDatabase): Promise<RevocationDatabase> {
  return database ?? (await import("./client")).db;
}

export const ADMIN_REVOCATION_AUDIT_RETENTION_MONTHS = 12;

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

export type ActiveSuperAdminRole =
  | "super_admin"
  | "super_admin_editor"
  | "super_admin_lector";

export type ActiveSuperAdminRow = {
  id: string;
  email: string | null;
  role: ActiveSuperAdminRole;
  createdAt: Date;
  hasPassword: boolean;
};

export type AdminRevocationStepUpResult =
  | { ok: true }
  | {
      ok: false;
      reason: "not_allowed" | "no_password" | "invalid_password" | "rate_limited";
    };

export type AdminRevocationStepUpVerifierDependencies = {
  checkRateLimit: (
    action: "login",
    identifier: string,
  ) => Promise<{ allowed: boolean }>;
  recordFailure: (action: "login", identifier: string) => Promise<unknown>;
  verifyPassword: (password: string, passwordHash: string) => boolean;
};

export type RevokeSuperAdminAccountInput = {
  actorId: string;
  targetId: string;
  password: unknown;
};

export type RevokeSuperAdminAccountFailureReason =
  | "not_allowed"
  | "no_password"
  | "invalid_password"
  | "rate_limited"
  | "target_not_found"
  | "target_already_revoked"
  | "target_not_allowed"
  | "self_revocation"
  | "insufficient_permissions";

export type RevokeSuperAdminAccountResult =
  | {
      ok: true;
      auditId: string;
    }
  | {
      ok: false;
      reason: RevokeSuperAdminAccountFailureReason;
    };

export function createAdminRevocationStepUpVerifier({
  checkRateLimit: checkLimit,
  recordFailure: storeFailure,
  verifyPassword,
}: AdminRevocationStepUpVerifierDependencies) {
  return async (
    userId: string,
    password: unknown,
    passwordHash: string,
  ): Promise<AdminRevocationStepUpResult> => {
    const identifier = `admin-revocation:${userId}`;
    const limit = await checkLimit("login", identifier);
    if (!limit.allowed) return { ok: false, reason: "rate_limited" };
    if (typeof password !== "string" || !verifyPassword(password, passwordHash)) {
      await storeFailure("login", identifier);
      return { ok: false, reason: "invalid_password" };
    }
    return { ok: true };
  };
}

const defaultStepUpVerifier = createAdminRevocationStepUpVerifier({
  checkRateLimit,
  recordFailure,
  verifyPassword: verifyStoredPassword,
});

async function executeListActiveSuperAdmins(
  database?: RevocationDatabase,
): Promise<ActiveSuperAdminRow[]> {
  const resolvedDb = await resolveDatabase(database);
  const rows = await resolvedDb
    .select({
      id: schema.users.id,
      email: schema.users.email,
      role: schema.users.role,
      createdAt: schema.users.createdAt,
      passwordHash: schema.users.passwordHash,
    })
    .from(schema.users)
    .where(
      and(
        inArray(schema.users.role, [
          "super_admin",
          "super_admin_editor",
          "super_admin_lector",
        ]),
        isNull(schema.users.revokedAt),
      ),
    )
    .orderBy(asc(schema.users.role), asc(schema.users.email));

  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    role: r.role as ActiveSuperAdminRole,
    createdAt: r.createdAt,
    hasPassword: r.passwordHash !== null,
  }));
}

async function executeVerifyAdminRevocationStepUp(
  userId: string,
  password: unknown,
  database?: RevocationDatabase,
): Promise<AdminRevocationStepUpResult> {
  const resolvedDb = await resolveDatabase(database);
  const users = await resolvedDb
    .select({
      role: schema.users.role,
      passwordHash: schema.users.passwordHash,
    })
    .from(schema.users)
    .where(
      and(
        eq(schema.users.id, userId),
        isNull(schema.users.revokedAt),
      ),
    )
    .limit(1);

  if (
    !(users.length > 0)
    || (users[0].role !== "super_admin" && users[0].role !== "super_admin_editor")
  ) {
    return { ok: false, reason: "not_allowed" };
  }
  if (users[0].passwordHash === null) {
    return { ok: false, reason: "no_password" };
  }
  return defaultStepUpVerifier(userId, password, users[0].passwordHash);
}

async function executeRevokeSuperAdminAccount(
  { actorId, targetId, password }: RevokeSuperAdminAccountInput,
  database?: RevocationDatabase,
  now: Date = new Date(),
  stepUpVerifier: (
    userId: string,
    password: unknown,
    database?: RevocationDatabase,
  ) => Promise<AdminRevocationStepUpResult> = executeVerifyAdminRevocationStepUp,
): Promise<RevokeSuperAdminAccountResult> {
  if (actorId === targetId) {
    return { ok: false, reason: "self_revocation" };
  }

  const stepUp = await stepUpVerifier(actorId, password, database);
  if (!stepUp.ok) {
    return { ok: false, reason: stepUp.reason };
  }

  const resolvedDb = await resolveDatabase(database);

  return resolvedDb.transaction(async (tx) => {
    const actors = await tx
      .select({
        id: schema.users.id,
        email: schema.users.email,
        role: schema.users.role,
        revokedAt: schema.users.revokedAt,
      })
      .from(schema.users)
      .where(
        and(
          eq(schema.users.id, actorId),
          isNull(schema.users.revokedAt),
        ),
      )
      .for("update")
      .limit(1);

    if (actors.length === 0) {
      return { ok: false, reason: "not_allowed" };
    }
    const actor = actors[0];
    if (actor.role !== "super_admin" && actor.role !== "super_admin_editor") {
      return { ok: false, reason: "not_allowed" };
    }

    const targets = await tx
      .select({
        id: schema.users.id,
        email: schema.users.email,
        role: schema.users.role,
        revokedAt: schema.users.revokedAt,
      })
      .from(schema.users)
      .where(eq(schema.users.id, targetId))
      .for("update")
      .limit(1);

    if (targets.length === 0) {
      return { ok: false, reason: "target_not_found" };
    }
    const target = targets[0];
    if (target.id === actor.id) {
      return { ok: false, reason: "self_revocation" };
    }
    if (target.revokedAt !== null) {
      return { ok: false, reason: "target_already_revoked" };
    }
    if (target.role === "super_admin") {
      return { ok: false, reason: "target_not_allowed" };
    }
    if (target.role !== "super_admin_editor" && target.role !== "super_admin_lector") {
      return { ok: false, reason: "target_not_allowed" };
    }

    if (target.role === "super_admin_editor" && actor.role !== "super_admin") {
      return { ok: false, reason: "insufficient_permissions" };
    }

    if (!actor.email || !target.email) {
      return { ok: false, reason: "not_allowed" };
    }

    const updatedUsers = await tx
      .update(schema.users)
      .set({ revokedAt: now })
      .where(
        and(
          eq(schema.users.id, targetId),
          isNull(schema.users.revokedAt),
        ),
      )
      .returning({ id: schema.users.id });

    if (updatedUsers.length === 0) {
      return { ok: false, reason: "target_already_revoked" };
    }

    await tx
      .delete(schema.sessions)
      .where(eq(schema.sessions.userId, targetId));

    await tx
      .update(schema.adminInvitations)
      .set({ revokedAt: now })
      .where(
        and(
          eq(schema.adminInvitations.invitedByUserId, targetId),
          isNull(schema.adminInvitations.consumedAt),
          isNull(schema.adminInvitations.revokedAt),
        ),
      );

    const auditExpiresAt = addUtcMonths(now, ADMIN_REVOCATION_AUDIT_RETENTION_MONTHS);
    const audits = await tx
      .insert(schema.adminRevocationAudit)
      .values({
        revokedUserId: target.id,
        revokedByUserId: actor.id,
        revokedEmail: target.email,
        revokerEmail: actor.email,
        revokedRole: target.role,
        revokerRole: actor.role,
        createdAt: now,
        expiresAt: auditExpiresAt,
      })
      .returning({ id: schema.adminRevocationAudit.id });

    if (audits.length === 0) {
      throw new Error("Échec d’écriture du journal de révocation.");
    }

    return { ok: true, auditId: audits[0].id };
  });
}

export type AdminRevocationServiceDependencies = {
  database?: RevocationDatabase;
  now?: () => Date;
  stepUpVerifier?: (
    userId: string,
    password: unknown,
    database?: RevocationDatabase,
  ) => Promise<AdminRevocationStepUpResult>;
};

export function createAdminRevocationService(deps?: AdminRevocationServiceDependencies) {
  return {
    async listActiveSuperAdmins(database?: RevocationDatabase): Promise<ActiveSuperAdminRow[]> {
      return executeListActiveSuperAdmins(database ?? deps?.database);
    },
    async verifyAdminRevocationStepUp(
      userId: string,
      password: unknown,
      database?: RevocationDatabase,
    ): Promise<AdminRevocationStepUpResult> {
      if (deps?.stepUpVerifier) {
        return deps.stepUpVerifier(userId, password, database ?? deps?.database);
      }
      return executeVerifyAdminRevocationStepUp(userId, password, database ?? deps?.database);
    },
    async revokeSuperAdminAccount(
      input: RevokeSuperAdminAccountInput,
      databaseOrOptions?: RevocationDatabase | {
        database?: RevocationDatabase;
        now?: Date;
        stepUpVerifier?: (
          userId: string,
          password: unknown,
          database?: RevocationDatabase,
        ) => Promise<AdminRevocationStepUpResult>;
      },
      nowArg?: Date,
    ): Promise<RevokeSuperAdminAccountResult> {
      let activeDb = deps?.database;
      let activeNow = deps?.now ? deps.now() : undefined;
      let activeVerifier = deps?.stepUpVerifier ?? executeVerifyAdminRevocationStepUp;

      if (databaseOrOptions && typeof (databaseOrOptions as any).transaction === "function") {
        activeDb = databaseOrOptions as RevocationDatabase;
      } else if (databaseOrOptions && typeof databaseOrOptions === "object") {
        const opts = databaseOrOptions as {
          database?: RevocationDatabase;
          now?: Date;
          stepUpVerifier?: (
            userId: string,
            password: unknown,
            database?: RevocationDatabase,
          ) => Promise<AdminRevocationStepUpResult>;
        };
        if (opts.database) activeDb = opts.database;
        if (opts.now) activeNow = opts.now;
        if (opts.stepUpVerifier) activeVerifier = opts.stepUpVerifier;
      }

      if (nowArg) activeNow = nowArg;

      return executeRevokeSuperAdminAccount(
        input,
        activeDb,
        activeNow ?? new Date(),
        activeVerifier,
      );
    },
  };
}

const service = createAdminRevocationService();

export const listActiveSuperAdmins = service.listActiveSuperAdmins;
export const verifyAdminRevocationStepUp = service.verifyAdminRevocationStepUp;
export const revokeSuperAdminAccount = service.revokeSuperAdminAccount;
