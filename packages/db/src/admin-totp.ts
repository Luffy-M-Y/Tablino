import { and, eq, isNotNull, isNull, lt, or } from "drizzle-orm";
import type { db as sharedDb } from "./client";
import * as schema from "./schema";

type AdminTotpDatabase = typeof sharedDb;

async function resolveDatabase(database?: AdminTotpDatabase): Promise<AdminTotpDatabase> {
  return database ?? (await import("./client")).db;
}

const ADMIN_ROLES: readonly string[] = [
  "super_admin",
  "super_admin_editor",
  "super_admin_lector",
  "university_admin",
];

function readId(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

// Contrôle en JS (le harnais de test n'exécute pas le where) : admin non révoqué.
function isActiveAdmin(row: { role: string; revokedAt: Date | null } | undefined): boolean {
  return Boolean(row && ADMIN_ROLES.includes(row.role) && row.revokedAt === null);
}

export type AdminTotpState =
  | { ok: true; status: "none"; email: string | null }
  | { ok: true; status: "pending"; email: string | null; secretEncrypted: string }
  | { ok: true; status: "enabled"; email: string | null }
  | { ok: false; reason: "invalid_input" | "not_authorized" };

/** État de la 2FA d'un admin : aucune, activation en cours (secret chiffré) ou active. */
export async function getAdminTotpState(
  input: { userId: string },
  database?: AdminTotpDatabase,
): Promise<AdminTotpState> {
  const userId = readId(input?.userId);
  if (userId === null) return { ok: false, reason: "invalid_input" };

  const db = await resolveDatabase(database);
  const users = await db
    .select({ role: schema.users.role, revokedAt: schema.users.revokedAt, email: schema.users.email })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  const user = users[0];
  if (!isActiveAdmin(user)) return { ok: false, reason: "not_authorized" };

  const rows = await db
    .select({ secretEncrypted: schema.adminTotp.secretEncrypted, enabledAt: schema.adminTotp.enabledAt })
    .from(schema.adminTotp)
    .where(eq(schema.adminTotp.userId, userId))
    .limit(1);
  const row = rows[0];
  const email = user.email || null;
  if (!row) return { ok: true, status: "none", email };
  if (row.enabledAt !== null) return { ok: true, status: "enabled", email };
  return { ok: true, status: "pending", email, secretEncrypted: row.secretEncrypted };
}

export type StartAdminTotpEnrollmentResult =
  | { ok: true }
  | { ok: false; reason: "invalid_input" | "not_authorized" | "already_enabled" };

/**
 * Lance (ou relance) l'activation : enregistre un nouveau secret chiffré, enabledAt nul.
 * Une 2FA déjà active n'est jamais remplacée.
 */
export async function startAdminTotpEnrollment(
  input: { userId: string; secretEncrypted: string },
  database?: AdminTotpDatabase,
  now = new Date(),
): Promise<StartAdminTotpEnrollmentResult> {
  const userId = readId(input?.userId);
  const secretEncrypted = readId(input?.secretEncrypted);
  if (userId === null || secretEncrypted === null) return { ok: false, reason: "invalid_input" };

  return (await resolveDatabase(database)).transaction(async (tx) => {
    const users = await tx
      .select({ role: schema.users.role, revokedAt: schema.users.revokedAt })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .for("update")
      .limit(1);
    if (!isActiveAdmin(users[0])) return { ok: false, reason: "not_authorized" };

    const saved = await tx
      .insert(schema.adminTotp)
      .values({ userId, secretEncrypted, enabledAt: null, lastUsedStep: null, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: schema.adminTotp.userId,
        set: { secretEncrypted, lastUsedStep: null, updatedAt: now },
        setWhere: isNull(schema.adminTotp.enabledAt),
      })
      .returning({ userId: schema.adminTotp.userId });
    if (saved.length === 0) return { ok: false, reason: "already_enabled" };
    return { ok: true };
  });
}

export type ConfirmAdminTotpEnrollmentResult =
  | { ok: true }
  | { ok: false; reason: "invalid_input" | "not_authorized" | "not_pending" };

/**
 * Termine l'activation après vérification du code par l'appelant.
 * Le secret doit être celui qui a servi à la vérification, encore en attente.
 */
export async function confirmAdminTotpEnrollment(
  input: { userId: string; secretEncrypted: string; step: number },
  database?: AdminTotpDatabase,
  now = new Date(),
): Promise<ConfirmAdminTotpEnrollmentResult> {
  const userId = readId(input?.userId);
  const secretEncrypted = readId(input?.secretEncrypted);
  const step = input?.step;
  if (userId === null || secretEncrypted === null || !Number.isSafeInteger(step) || step < 0) {
    return { ok: false, reason: "invalid_input" };
  }

  return (await resolveDatabase(database)).transaction(async (tx) => {
    const users = await tx
      .select({ role: schema.users.role, revokedAt: schema.users.revokedAt })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .for("update")
      .limit(1);
    if (!isActiveAdmin(users[0])) return { ok: false, reason: "not_authorized" };

    const updated = await tx
      .update(schema.adminTotp)
      .set({ enabledAt: now, lastUsedStep: step, updatedAt: now })
      .where(and(
        eq(schema.adminTotp.userId, userId),
        eq(schema.adminTotp.secretEncrypted, secretEncrypted),
        isNull(schema.adminTotp.enabledAt),
      ))
      .returning({ userId: schema.adminTotp.userId });
    if (updated.length === 0) return { ok: false, reason: "not_pending" };
    return { ok: true };
  });
}

export type AdminTotpLoginState =
  | { ok: true; status: "none" }
  | { ok: true; status: "pending"; secretEncrypted: string }
  | { ok: true; status: "enabled"; secretEncrypted: string; lastUsedStep: number | null }
  | { ok: false; reason: "invalid_input" | "not_authorized" };

/** État 2FA lu à la connexion (avant toute session) : secret chiffré et dernier pas utilisé. */
export async function getAdminTotpLoginState(
  input: { userId: string },
  database?: AdminTotpDatabase,
): Promise<AdminTotpLoginState> {
  const userId = readId(input?.userId);
  if (userId === null) return { ok: false, reason: "invalid_input" };

  const db = await resolveDatabase(database);
  const users = await db
    .select({ role: schema.users.role, revokedAt: schema.users.revokedAt })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  if (!isActiveAdmin(users[0])) return { ok: false, reason: "not_authorized" };

  const rows = await db
    .select({
      secretEncrypted: schema.adminTotp.secretEncrypted,
      enabledAt: schema.adminTotp.enabledAt,
      lastUsedStep: schema.adminTotp.lastUsedStep,
    })
    .from(schema.adminTotp)
    .where(eq(schema.adminTotp.userId, userId))
    .limit(1);
  const row = rows[0];
  if (!row) return { ok: true, status: "none" };
  if (row.enabledAt === null) return { ok: true, status: "pending", secretEncrypted: row.secretEncrypted };
  return { ok: true, status: "enabled", secretEncrypted: row.secretEncrypted, lastUsedStep: row.lastUsedStep ?? null };
}

export type RecordAdminTotpLoginResult =
  | { ok: true }
  | { ok: false; reason: "invalid_input" | "not_authorized" | "replayed" };

/**
 * Anti-rejeu en base : enregistre le pas du code accepté seulement s'il est plus récent
 * que le dernier (UPDATE conditionnel), pour une 2FA active et le même secret.
 */
export async function recordAdminTotpLogin(
  input: { userId: string; secretEncrypted: string; step: number },
  database?: AdminTotpDatabase,
  now = new Date(),
): Promise<RecordAdminTotpLoginResult> {
  const userId = readId(input?.userId);
  const secretEncrypted = readId(input?.secretEncrypted);
  const step = input?.step;
  if (userId === null || secretEncrypted === null || !Number.isSafeInteger(step) || step < 0) {
    return { ok: false, reason: "invalid_input" };
  }

  return (await resolveDatabase(database)).transaction(async (tx) => {
    const users = await tx
      .select({ role: schema.users.role, revokedAt: schema.users.revokedAt })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .for("update")
      .limit(1);
    if (!isActiveAdmin(users[0])) return { ok: false, reason: "not_authorized" };

    const updated = await tx
      .update(schema.adminTotp)
      .set({ lastUsedStep: step, updatedAt: now })
      .where(and(
        eq(schema.adminTotp.userId, userId),
        eq(schema.adminTotp.secretEncrypted, secretEncrypted),
        isNotNull(schema.adminTotp.enabledAt),
        or(isNull(schema.adminTotp.lastUsedStep), lt(schema.adminTotp.lastUsedStep, step)),
      ))
      .returning({ userId: schema.adminTotp.userId });
    if (updated.length === 0) return { ok: false, reason: "replayed" };
    return { ok: true };
  });
}
