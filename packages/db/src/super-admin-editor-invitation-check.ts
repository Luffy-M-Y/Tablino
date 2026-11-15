import { and, gt, isNull, sql } from "drizzle-orm";
import type { db as sharedDb } from "./client";
import * as schema from "./schema";
import { hashSuperAdminEditorInvitationToken } from "./super-admin-editor-invitation";

type CheckDatabase = typeof sharedDb;

async function resolveDatabase(database?: CheckDatabase): Promise<CheckDatabase> {
  return database ?? (await import("./client")).db;
}

export type InvitationCheckDependencies = {
  checkByHash: (tokenHash: string, now: Date) => Promise<boolean>;
  now?: () => Date;
};

export function createInvitationCheckService(deps: InvitationCheckDependencies) {
  const resolveNow = deps.now ?? (() => new Date());

  return {
    async checkSuperAdminEditorInvitationToken(token: unknown): Promise<boolean> {
      if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
        return false;
      }
      const tokenHash = hashSuperAdminEditorInvitationToken(token);
      return deps.checkByHash(tokenHash, resolveNow());
    },
  };
}

const service = createInvitationCheckService({
  checkByHash: async (tokenHash, now) => {
    const db = await resolveDatabase();
    const rows = await db
      .select({ id: schema.superAdminEditorInvitations.id })
      .from(schema.superAdminEditorInvitations)
      .where(
        and(
          sql`${schema.superAdminEditorInvitations.tokenHash} = ${tokenHash}`,
          isNull(schema.superAdminEditorInvitations.consumedAt),
          isNull(schema.superAdminEditorInvitations.revokedAt),
          gt(schema.superAdminEditorInvitations.expiresAt, now),
        ),
      )
      .limit(1);
    return rows.length > 0;
  },
});

export const checkSuperAdminEditorInvitationToken =
  service.checkSuperAdminEditorInvitationToken.bind(service);
