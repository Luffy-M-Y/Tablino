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

type OutboxDatabase = typeof sharedDb;

async function resolveDatabase(database?: OutboxDatabase): Promise<OutboxDatabase> {
  return database ?? (await import("./client")).db;
}

export const ADMIN_REVOCATION_ALERT_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
export const ADMIN_REVOCATION_ALERT_LEASE_MS = 10 * 60 * 1000;
export const ADMIN_REVOCATION_ALERT_RETRY_DELAYS_MS = Object.freeze([
  20 * 60 * 1000,
  40 * 60 * 1000,
]);

export type RevokedAdminRole = "super_admin_editor" | "super_admin_lector";

export function isRevokedAdminRole(value: unknown): value is RevokedAdminRole {
  return value === "super_admin_editor" || value === "super_admin_lector";
}

export function isAdminRevocationAlertReservationDue(
  status: string,
  nextAttemptAt: Date,
  now: Date,
): boolean {
  return (
    (status === "pending" || status === "processing")
    && nextAttemptAt.getTime() <= now.getTime()
  );
}

export function getAdminRevocationAlertReservationState(attempts: number, now: Date) {
  if (!Number.isInteger(attempts) || attempts < 0 || attempts > 3) {
    throw new RangeError("Nombre de réservations d’alerte invalide.");
  }
  if (attempts === 3) {
    return { status: "failed" as const, attempts, nextAttemptAt: null };
  }
  return {
    status: "processing" as const,
    attempts: attempts + 1,
    nextAttemptAt: new Date(now.getTime() + ADMIN_REVOCATION_ALERT_LEASE_MS),
  };
}

export function getAdminRevocationAlertFailureState(attempts: number, now: Date) {
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 3) {
    throw new RangeError("Nombre de tentatives d’alerte invalide.");
  }
  if (attempts === 3) {
    return { status: "failed" as const, nextAttemptAt: null };
  }
  return {
    status: "pending" as const,
    nextAttemptAt: new Date(
      now.getTime() + ADMIN_REVOCATION_ALERT_RETRY_DELAYS_MS[attempts - 1],
    ),
  };
}

export type AdminRevocationAlert = {
  recipientEmail: string;
  revokerEmail: string;
  revokedEmail: string;
  revokedRole: RevokedAdminRole;
  revokedAt: Date;
};

export type AdminRevocationAlertSender = (
  alert: AdminRevocationAlert,
) => Promise<void>;

export type ProcessAdminRevocationAlertOutboxResult = {
  processed: number;
  sent: number;
  retried: number;
  failed: number;
};

export async function enqueueAdminRevocationAlerts(
  auditId: string,
  now = new Date(),
  database?: OutboxDatabase,
): Promise<number> {
  const resolvedDatabase = await resolveDatabase(database);
  const audits = await resolvedDatabase
    .select({
      id: schema.adminRevocationAudit.id,
      createdAt: schema.adminRevocationAudit.createdAt,
    })
    .from(schema.adminRevocationAudit)
    .where(eq(schema.adminRevocationAudit.id, auditId))
    .limit(1);
  if (!(audits.length > 0)) return 0;

  const recipients = await resolvedDatabase
    .select({ email: schema.users.email })
    .from(schema.users)
    .where(
      and(
        inArray(schema.users.role, ["super_admin", "super_admin_editor"]),
        isNull(schema.users.revokedAt),
        isNotNull(schema.users.email),
      ),
    );
  if (!(recipients.length > 0)) return 0;

  const createdAt = audits[0].createdAt;
  const queued = await resolvedDatabase
    .insert(schema.adminRevocationAlertOutbox)
    .values(
      recipients.map(({ email }) => ({
        auditId,
        recipientEmail: email!,
        status: "pending",
        attempts: 0,
        nextAttemptAt: now,
        createdAt: now,
        expiresAt: new Date(createdAt.getTime() + ADMIN_REVOCATION_ALERT_RETENTION_MS),
      })),
    )
    .onConflictDoNothing()
    .returning({ id: schema.adminRevocationAlertOutbox.id });
  return queued.length;
}

export async function processAdminRevocationAlertOutbox(
  sendAlert: AdminRevocationAlertSender,
  now = new Date(),
  database?: OutboxDatabase,
  batchSize = 100,
): Promise<ProcessAdminRevocationAlertOutboxResult> {
  const resolvedDatabase = await resolveDatabase(database);
  const result: ProcessAdminRevocationAlertOutboxResult = {
    processed: 0,
    sent: 0,
    retried: 0,
    failed: 0,
  };

  await purgeExpiredRevocationAlerts(resolvedDatabase, now);

  while (result.processed < batchSize) {
    const outcome = await resolvedDatabase.transaction(async (tx) => {
      const dueRows = await tx
        .select({
          id: schema.adminRevocationAlertOutbox.id,
          attempts: schema.adminRevocationAlertOutbox.attempts,
          recipientEmail: schema.adminRevocationAlertOutbox.recipientEmail,
          revokerEmail: schema.adminRevocationAudit.revokerEmail,
          revokedEmail: schema.adminRevocationAudit.revokedEmail,
          revokedRole: schema.adminRevocationAudit.revokedRole,
          revokedAt: schema.adminRevocationAudit.createdAt,
        })
        .from(schema.adminRevocationAlertOutbox)
        .innerJoin(
          schema.adminRevocationAudit,
          eq(
            schema.adminRevocationAlertOutbox.auditId,
            schema.adminRevocationAudit.id,
          ),
        )
        .where(
          and(
            or(
              eq(schema.adminRevocationAlertOutbox.status, "pending"),
              eq(schema.adminRevocationAlertOutbox.status, "processing"),
            ),
            lte(schema.adminRevocationAlertOutbox.nextAttemptAt, now),
            gt(schema.adminRevocationAlertOutbox.expiresAt, now),
          ),
        )
        .orderBy(
          asc(schema.adminRevocationAlertOutbox.nextAttemptAt),
          asc(schema.adminRevocationAlertOutbox.createdAt),
        )
        .limit(1)
        .for("update", { skipLocked: true });

      if (!(dueRows.length > 0)) return null;
      const row = dueRows[0];
      if (!isRevokedAdminRole(row.revokedRole)) {
        await tx
          .update(schema.adminRevocationAlertOutbox)
          .set({ status: "failed" })
          .where(eq(schema.adminRevocationAlertOutbox.id, row.id));
        return { kind: "failed" as const };
      }

      const reservation = getAdminRevocationAlertReservationState(row.attempts, now);
      if (reservation.status === "failed") {
        await tx
          .update(schema.adminRevocationAlertOutbox)
          .set({ status: "failed" })
          .where(eq(schema.adminRevocationAlertOutbox.id, row.id));
        return { kind: "failed" as const };
      }

      await tx
        .update(schema.adminRevocationAlertOutbox)
        .set({
          status: reservation.status,
          attempts: reservation.attempts,
          nextAttemptAt: reservation.nextAttemptAt,
        })
        .where(eq(schema.adminRevocationAlertOutbox.id, row.id));

      return {
        kind: "reserved" as const,
        row: {
          ...row,
          revokedRole: row.revokedRole as RevokedAdminRole,
        },
        attempts: reservation.attempts,
      };
    });

    if (outcome === null) break;
    if (outcome.kind === "failed") {
      result.processed += 1;
      result.failed += 1;
      continue;
    }

    const reservationFilter = and(
      eq(schema.adminRevocationAlertOutbox.id, outcome.row.id),
      eq(schema.adminRevocationAlertOutbox.status, "processing"),
      eq(schema.adminRevocationAlertOutbox.attempts, outcome.attempts),
    );

    let deliveryFailed = false;
    try {
      await sendAlert({
        recipientEmail: outcome.row.recipientEmail,
        revokerEmail: outcome.row.revokerEmail,
        revokedEmail: outcome.row.revokedEmail,
        revokedRole: outcome.row.revokedRole,
        revokedAt: outcome.row.revokedAt,
      });
    } catch {
      deliveryFailed = true;
    }

    if (deliveryFailed) {
      const retry = getAdminRevocationAlertFailureState(outcome.attempts, now);
      const updated = await resolvedDatabase
        .update(schema.adminRevocationAlertOutbox)
        .set({
          status: retry.status,
          nextAttemptAt: retry.nextAttemptAt ?? now,
        })
        .where(reservationFilter)
        .returning({ id: schema.adminRevocationAlertOutbox.id });
      result.processed += 1;
      if (updated.length > 0) {
        if (retry.status === "pending") result.retried += 1;
        if (retry.status === "failed") result.failed += 1;
      }
      continue;
    }

    const updated = await resolvedDatabase
      .update(schema.adminRevocationAlertOutbox)
      .set({ status: "sent", sentAt: now })
      .where(reservationFilter)
      .returning({ id: schema.adminRevocationAlertOutbox.id });
    result.processed += 1;
    if (updated.length > 0) result.sent += 1;
  }

  await purgeExpiredRevocationAlerts(resolvedDatabase, now);
  return result;
}

async function purgeExpiredRevocationAlerts(
  database: OutboxDatabase,
  now: Date,
): Promise<void> {
  await database
    .delete(schema.adminRevocationAlertOutbox)
    .where(lte(schema.adminRevocationAlertOutbox.expiresAt, now));
  await database
    .delete(schema.adminRevocationAudit)
    .where(lte(schema.adminRevocationAudit.expiresAt, now));
}
