import { and, gt, isNull, sql } from "drizzle-orm";
import type { db as sharedDb } from "./client";
import * as schema from "./schema";
import {
  hashAdminInvitationToken,
  isAdminInvitationRole,
  type AdminInvitationRole,
} from "./admin-invitation";

type CheckDatabase = typeof sharedDb;

async function resolveDatabase(database?: CheckDatabase): Promise<CheckDatabase> {
  return database ?? (await import("./client")).db;
}

export type InvitationCheckDependencies = {
  checkByHash: (tokenHash: string, now: Date) => Promise<AdminInvitationRole | null>;
  now?: () => Date;
};

export function createInvitationCheckService(deps: InvitationCheckDependencies) {
  const resolveNow = deps.now ?? (() => new Date());

  return {
    async checkAdminInvitationToken(token: unknown): Promise<AdminInvitationRole | null> {
      if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
        return null;
      }
      const tokenHash = hashAdminInvitationToken(token);
      return deps.checkByHash(tokenHash, resolveNow());
    },
  };
}

const service = createInvitationCheckService({
  checkByHash: async (tokenHash, now) => {
    const db = await resolveDatabase();
    const rows = await db
      .select({ role: schema.adminInvitations.role })
      .from(schema.adminInvitations)
      .where(
        and(
          sql`${schema.adminInvitations.tokenHash} = ${tokenHash}`,
          isNull(schema.adminInvitations.consumedAt),
          isNull(schema.adminInvitations.revokedAt),
          gt(schema.adminInvitations.expiresAt, now),
        ),
      )
      .limit(1);
    const invitation = rows[0];
    if (!invitation || !isAdminInvitationRole(invitation.role)) return null;
    return invitation.role;
  },
});

export const checkAdminInvitationToken =
  service.checkAdminInvitationToken.bind(service);
