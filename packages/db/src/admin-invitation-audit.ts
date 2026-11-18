import { and, desc, eq, gt, isNull } from "drizzle-orm";
import type { db as sharedDb } from "./client";
import * as schema from "./schema";
import {
  isAdminInvitationRole,
  type AdminInvitationRole,
} from "./admin-invitation";

type AuditDatabase = typeof sharedDb;

async function resolveDatabase(database?: AuditDatabase): Promise<AuditDatabase> {
  return database ?? (await import("./client")).db;
}

export type AdminInvitationAuditRow = {
  id: string;
  invitedByUserId: string;
  inviterEmail: string;
  invitedEmail: string;
  role: AdminInvitationRole;
  clientIp: string | null;
  createdAt: Date;
};

export type AdminInvitationAuditResult =
  | { ok: true; rows: AdminInvitationAuditRow[] }
  | { ok: false; reason: "forbidden" };

export type AdminInvitationAuditRepository = {
  getActiveRole: (userId: string) => Promise<string | null>;
  listSince: (now: Date) => Promise<AdminInvitationAuditRow[]>;
};

export function createAdminInvitationAuditService(
  repository: AdminInvitationAuditRepository,
) {
  return {
    async listAdminInvitationAudit(
      userId: string,
      now = new Date(),
    ): Promise<AdminInvitationAuditResult> {
      if (await repository.getActiveRole(userId) !== "super_admin") {
        return { ok: false, reason: "forbidden" };
      }
      return { ok: true, rows: await repository.listSince(now) };
    },
  };
}

const service = createAdminInvitationAuditService({
  getActiveRole: async (userId) => {
    const database = await resolveDatabase();
    const users = await database
      .select({ role: schema.users.role })
      .from(schema.users)
      .where(and(
        eq(schema.users.id, userId),
        isNull(schema.users.revokedAt),
      ))
      .limit(1);
    return users.length > 0 ? users[0].role : null;
  },
  listSince: async (now) => {
    const database = await resolveDatabase();
    const rows = await database
      .select({
        id: schema.adminInvitationAudit.id,
        invitedByUserId: schema.adminInvitationAudit.invitedByUserId,
        inviterEmail: schema.adminInvitationAudit.inviterEmail,
        invitedEmail: schema.adminInvitationAudit.invitedEmail,
        role: schema.adminInvitationAudit.role,
        clientIp: schema.adminInvitationAudit.clientIp,
        createdAt: schema.adminInvitationAudit.createdAt,
      })
      .from(schema.adminInvitationAudit)
      .where(gt(schema.adminInvitationAudit.expiresAt, now))
      .orderBy(desc(schema.adminInvitationAudit.createdAt));
    return rows.filter((row): row is typeof row & { role: AdminInvitationRole } =>
      isAdminInvitationRole(row.role),
    );
  },
});

export const listAdminInvitationAudit =
  service.listAdminInvitationAudit.bind(service);
