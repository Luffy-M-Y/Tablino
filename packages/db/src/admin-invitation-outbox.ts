import {
  and,
  asc,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  lte,
  or,
} from "drizzle-orm";
import type { db as sharedDb } from "./client";
import * as schema from "./schema";
import { isAdminInvitationRole, type AdminInvitationRole } from "./admin-invitation";
import {
  getAdminInvitationAlertDeliveryDisposition,
  getAdminInvitationAlertReservationState,
  ADMIN_INVITATION_ALERT_RETENTION_MS,
  getAdminInvitationAlertFailureState,
} from "./admin-invitation-outbox-state.mjs";

type OutboxDatabase = typeof sharedDb;

async function resolveDatabase(database?: OutboxDatabase): Promise<OutboxDatabase> {
  return database ?? (await import("./client")).db;
}

export type AdminInvitationAlert = {
  recipientEmail: string;
  inviterEmail: string;
  invitedEmail: string;
  role: AdminInvitationRole;
  invitedAt: Date;
};

export type AdminInvitationAlertSender = (
  alert: AdminInvitationAlert,
) => Promise<void>;

export type ProcessAdminInvitationAlertOutboxResult = {
  processed: number;
  sent: number;
  retried: number;
  failed: number;
};

export async function enqueueAdminInvitationAlerts(
  auditId: string,
  now = new Date(),
  database?: OutboxDatabase,
): Promise<number> {
  const resolvedDatabase = await resolveDatabase(database);
  const audits = await resolvedDatabase
    .select({
      id: schema.adminInvitationAudit.id,
      createdAt: schema.adminInvitationAudit.createdAt,
    })
    .from(schema.adminInvitationAudit)
    .where(eq(schema.adminInvitationAudit.id, auditId))
    .limit(1);
  if (!(audits.length > 0)) return 0;

  const recipients = await resolvedDatabase
    .select({ email: schema.users.email })
    .from(schema.users)
    .where(and(
      inArray(schema.users.role, ["super_admin", "super_admin_editor"]),
      isNull(schema.users.revokedAt),
      isNotNull(schema.users.email),
    ));
  if (!(recipients.length > 0)) return 0;

  const createdAt = audits[0].createdAt;
  const queued = await resolvedDatabase
    .insert(schema.adminInvitationAlertOutbox)
    .values(recipients.map(({ email }) => ({
      auditId,
      recipientEmail: email,
      status: "pending",
      attempts: 0,
      nextAttemptAt: now,
      createdAt: now,
      expiresAt: new Date(createdAt.getTime() + ADMIN_INVITATION_ALERT_RETENTION_MS),
    })))
    .onConflictDoNothing()
    .returning({ id: schema.adminInvitationAlertOutbox.id });
  return queued.length;
}

export async function processAdminInvitationAlertOutbox(
  sendAlert: AdminInvitationAlertSender,
  now = new Date(),
  database?: OutboxDatabase,
  batchSize = 100,
): Promise<ProcessAdminInvitationAlertOutboxResult> {
  const resolvedDatabase = await resolveDatabase(database);
  const result: ProcessAdminInvitationAlertOutboxResult = {
    processed: 0,
    sent: 0,
    retried: 0,
    failed: 0,
  };

  await purgeExpiredInvitationAlerts(resolvedDatabase, now);

  while (result.processed < batchSize) {
    const outcome = await resolvedDatabase.transaction(async (tx) => {
      const dueRows = await tx
        .select({
          id: schema.adminInvitationAlertOutbox.id,
          attempts: schema.adminInvitationAlertOutbox.attempts,
          recipientEmail: schema.adminInvitationAlertOutbox.recipientEmail,
          inviterEmail: schema.adminInvitationAudit.inviterEmail,
          invitedEmail: schema.adminInvitationAudit.invitedEmail,
          role: schema.adminInvitationAudit.role,
          invitedAt: schema.adminInvitationAudit.createdAt,
        })
        .from(schema.adminInvitationAlertOutbox)
        .innerJoin(
          schema.adminInvitationAudit,
          eq(
            schema.adminInvitationAlertOutbox.auditId,
            schema.adminInvitationAudit.id,
          ),
        )
        .where(and(
          or(
            eq(schema.adminInvitationAlertOutbox.status, "pending"),
            eq(schema.adminInvitationAlertOutbox.status, "processing"),
          ),
          lte(schema.adminInvitationAlertOutbox.nextAttemptAt, now),
          gt(schema.adminInvitationAlertOutbox.expiresAt, now),
        ))
        .orderBy(
          asc(schema.adminInvitationAlertOutbox.nextAttemptAt),
          asc(schema.adminInvitationAlertOutbox.createdAt),
        )
        .limit(1)
        .for("update", { skipLocked: true });

      if (!(dueRows.length > 0)) return null;
      const row = dueRows[0];
      if (!isAdminInvitationRole(row.role)) {
        await tx
          .update(schema.adminInvitationAlertOutbox)
          .set({ status: "failed" })
          .where(eq(schema.adminInvitationAlertOutbox.id, row.id));
        return { kind: "failed" as const };
      }

      const reservation = getAdminInvitationAlertReservationState(row.attempts, now);
      if (reservation.status === "failed") {
        await tx
          .update(schema.adminInvitationAlertOutbox)
          .set({ status: "failed" })
          .where(eq(schema.adminInvitationAlertOutbox.id, row.id));
        return { kind: "failed" as const };
      }

      await tx
        .update(schema.adminInvitationAlertOutbox)
        .set({
          status: reservation.status,
          attempts: reservation.attempts,
          nextAttemptAt: reservation.nextAttemptAt,
        })
        .where(eq(schema.adminInvitationAlertOutbox.id, row.id));

      return {
        kind: "reserved" as const,
        row,
        attempts: reservation.attempts,
      };
    });

    if (outcome === null) break;
    if (outcome.kind === "failed") {
      result.processed += 1;
      result.failed += 1;
      continue;
    }

    const delivery = getAdminInvitationAlertDeliveryDisposition(
      outcome.row.role,
      isAdminInvitationRole,
    );
    const reservationFilter = and(
      eq(schema.adminInvitationAlertOutbox.id, outcome.row.id),
      eq(schema.adminInvitationAlertOutbox.status, "processing"),
      eq(schema.adminInvitationAlertOutbox.attempts, outcome.attempts),
    );
    if (delivery.kind === "failed") {
      const finalFailure = getAdminInvitationAlertFailureState(3, now);
      const updated = await resolvedDatabase
        .update(schema.adminInvitationAlertOutbox)
        .set({
          status: finalFailure.status,
          nextAttemptAt: finalFailure.nextAttemptAt ?? now,
        })
        .where(reservationFilter)
        .returning({ id: schema.adminInvitationAlertOutbox.id });
      result.processed += 1;
      if (updated.length > 0) result.failed += 1;
      continue;
    }

    let deliveryFailed = false;
    try {
      await sendAlert({
        recipientEmail: outcome.row.recipientEmail,
        inviterEmail: outcome.row.inviterEmail,
        invitedEmail: outcome.row.invitedEmail,
        role: delivery.role,
        invitedAt: outcome.row.invitedAt,
      });
    } catch {
      deliveryFailed = true;
    }

    if (deliveryFailed) {
      const retry = getAdminInvitationAlertFailureState(outcome.attempts, now);
      const updated = await resolvedDatabase
        .update(schema.adminInvitationAlertOutbox)
        .set({
          status: retry.status,
          nextAttemptAt: retry.nextAttemptAt ?? now,
        })
        .where(reservationFilter)
        .returning({ id: schema.adminInvitationAlertOutbox.id });
      result.processed += 1;
      if (updated.length > 0) {
        if (retry.status === "pending") result.retried += 1;
        if (retry.status === "failed") result.failed += 1;
      }
      continue;
    }

    const updated = await resolvedDatabase
      .update(schema.adminInvitationAlertOutbox)
      .set({ status: "sent", sentAt: now })
      .where(reservationFilter)
      .returning({ id: schema.adminInvitationAlertOutbox.id });
    result.processed += 1;
    if (updated.length > 0) result.sent += 1;
  }

  await purgeExpiredInvitationAlerts(resolvedDatabase, now);
  return result;
}

async function purgeExpiredInvitationAlerts(
  database: OutboxDatabase,
  now: Date,
): Promise<void> {
  await database
    .delete(schema.adminInvitationAlertOutbox)
    .where(lte(schema.adminInvitationAlertOutbox.expiresAt, now));
  await database
    .delete(schema.adminInvitationAudit)
    .where(lte(schema.adminInvitationAudit.expiresAt, now));
}
