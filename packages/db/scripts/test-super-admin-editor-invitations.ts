import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Pool } from "pg";
import { openGuardedDatabase } from "./_database-guard";

type ReadOnlySnapshot = {
  roleValues: string[];
  invitationTableExists: boolean;
  roleScopeCheck: string | null;
  migrationCount: number;
  lastMigrationAt: string | null;
  journalCount: number;
  readyForApply: boolean;
};

type ScenarioContext = {
  createInvitation: (email: string) => Promise<{
    invitationId: string;
    token: string;
  }>;
  consumeInvitation: (token: string, password: string) => Promise<boolean>;
};

function isApplyMode(): boolean {
  return process.argv.length === 3 && process.argv[2] === "--apply";
}

function hasValidArguments(): boolean {
  return process.argv.length === 2 || isApplyMode();
}

function safeDatabaseErrorCode(error: unknown): string {
  if (typeof error !== "object" || error === null || !("code" in error)) return "INCONNU";
  const code = error.code;
  return typeof code === "string" && /^[A-Z0-9_]+$/.test(code) ? code : "INCONNU";
}

function checkIsTextualRoleScope(definition: string | null): boolean {
  if (definition === null) return false;
  const normalized = definition.toLowerCase().replaceAll('"', "").replace(/\s+/g, "");
  const roleTextComparisons = normalized.match(/role\)?::text/g) ?? [];
  return roleTextComparisons.length >= 2
    && normalized.includes("'super_admin'")
    && normalized.includes("'super_admin_editor'")
    && normalized.includes("university_id");
}

async function readOnlySnapshot(pool: Pool): Promise<ReadOnlySnapshot> {
  const roleResult = await pool.query<{ value: string }>(
    `SELECT enumlabel AS value
     FROM pg_enum
     JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
     WHERE pg_type.typname = 'role'
     ORDER BY pg_enum.enumsortorder`,
  );
  const tableResult = await pool.query<{ exists: boolean }>(
    `SELECT to_regclass('public.super_admin_editor_invitations') IS NOT NULL AS exists`,
  );
  const checkResult = await pool.query<{ definition: string | null }>(
    `SELECT pg_get_constraintdef(oid) AS definition
     FROM pg_constraint
     WHERE conrelid = 'public.users'::regclass
       AND conname = 'users_role_university_scope_check'`,
  );
  const migrationTableResult = await pool.query<{ table_name: string | null }>(
    `SELECT to_regclass('drizzle.__drizzle_migrations')::text AS table_name`,
  );

  let migrationCount = 0;
  let lastMigrationAt: string | null = null;
  if (migrationTableResult.rows[0]?.table_name) {
    const migrationResult = await pool.query<{
      migration_count: string;
      last_migration_at: string | null;
    }>(
      `SELECT count(*)::text AS migration_count, max(created_at)::text AS last_migration_at
       FROM drizzle.__drizzle_migrations`,
    );
    migrationCount = Number(migrationResult.rows[0]?.migration_count ?? 0);
    lastMigrationAt = migrationResult.rows[0]?.last_migration_at ?? null;
  }

  const journal = JSON.parse(
    await readFile(resolve(__dirname, "../migrations/meta/_journal.json"), "utf8"),
  ) as { entries?: unknown[] };
  const roleValues = roleResult.rows.map(({ value }) => value);
  const roleScopeCheck = checkResult.rows[0]?.definition ?? null;
  const readyForApply = roleValues.includes("super_admin_editor")
    && tableResult.rows[0]?.exists === true
    && checkIsTextualRoleScope(roleScopeCheck);

  return {
    roleValues,
    invitationTableExists: tableResult.rows[0]?.exists === true,
    roleScopeCheck,
    migrationCount,
    lastMigrationAt,
    journalCount: Array.isArray(journal.entries) ? journal.entries.length : 0,
    readyForApply,
  };
}

function printReadOnlySnapshot(snapshot: ReadOnlySnapshot): void {
  process.stdout.write(`ROLE_ENUM ${JSON.stringify(snapshot.roleValues)}\n`);
  process.stdout.write(`INVITATION_TABLE ${snapshot.invitationTableExists ? "present" : "absent"}\n`);
  process.stdout.write(`ROLE_SCOPE_CHECK ${snapshot.roleScopeCheck ?? "absent"}\n`);
  process.stdout.write(
    `DRIZZLE_MIGRATIONS count=${snapshot.migrationCount} last=${snapshot.lastMigrationAt ?? "null"}\n`,
  );
  process.stdout.write(`JOURNAL_MIGRATIONS count=${snapshot.journalCount}\n`);
  process.stdout.write(`READ_ONLY_PREREQUISITES ${snapshot.readyForApply ? "OK" : "KO"}\n`);
}

async function markerEmailExists(pool: Pool): Promise<boolean> {
  const result = await pool.query<{ exists: boolean }>(
    `SELECT
       EXISTS (
         SELECT 1 FROM public.users
         WHERE email LIKE 'integration-editor-%@example.invalid'
       )
       OR EXISTS (
         SELECT 1 FROM public.super_admin_editor_invitations
         WHERE email LIKE 'integration-editor-%@example.invalid'
       ) AS exists`,
  );
  return result.rows[0]?.exists === true;
}

async function testUserInsertAndRollback(
  pool: Pool,
  email: string,
  universityId: string | null,
  expectCheckViolation: boolean,
): Promise<boolean> {
  const client = await pool.connect();
  let inserted = false;
  let caughtCode: string | undefined;
  try {
    await client.query("BEGIN");
    try {
      await client.query(
        `INSERT INTO public.users (email, role, university_id)
         VALUES ($1, 'super_admin_editor', $2)`,
        [email, universityId],
      );
      inserted = true;
    } catch (error) {
      caughtCode = safeDatabaseErrorCode(error);
    }

    await client.query("ROLLBACK");
    return expectCheckViolation
      ? caughtCode === "23514"
      : inserted && caughtCode === undefined;
  } catch {
    try {
      await client.query("ROLLBACK");
    } catch {
      return false;
    }
    return false;
  } finally {
    client.release();
  }
}

async function countRows(
  pool: Pool,
  table: "users" | "super_admin_editor_invitations",
  email: string,
): Promise<number> {
  const result = await pool.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM public.${table} WHERE email = $1`,
    [email],
  );
  return Number(result.rows[0]?.count ?? 0);
}

async function runScenario(
  name: string,
  run: () => Promise<boolean>,
): Promise<boolean> {
  try {
    const passed = await run();
    process.stdout.write(`${passed ? "OK" : "KO"} ${name}\n`);
    return passed;
  } catch {
    process.stdout.write(`KO ${name}\n`);
    return false;
  }
}

async function runApplyScenarios(pool: Pool, runId: string): Promise<boolean> {
  const superAdminResult = await pool.query<{ id: string }>(
    `SELECT id FROM public.users WHERE role = 'super_admin'`,
  );
  const inviterId = superAdminResult.rows.length === 1 ? superAdminResult.rows[0].id : null;
  const inviterCountPassed = inviterId !== null;
  process.stdout.write(`${inviterCountPassed ? "OK" : "KO"} exactly_one_super_admin_inviter\n`);
  if (!inviterId) return false;

  const universityResult = await pool.query<{ id: string }>(
    `SELECT id FROM public.universities LIMIT 1`,
  );
  const universityId = universityResult.rows[0]?.id;
  if (!universityId) {
    process.stdout.write("KO check_requires_existing_university\n");
    return false;
  }

  const password = randomBytes(32).toString("base64url");
  const { isPasswordValid } = await import("../src/password");
  if (!isPasswordValid(password)) {
    process.stdout.write("KO generated_password_is_valid\n");
    return false;
  }

  const { pool: servicePool } = await import("../src/client");
  try {
    const invitationService = await import("../src/super-admin-editor-invitation");
    const emailFor = (label: string) =>
      `integration-editor-${runId}-${label}@example.invalid`;
    const context: ScenarioContext = {
      async createInvitation(email) {
        const result = await invitationService.createSuperAdminEditorInvitation(email, inviterId);
        if (!result.ok) throw new Error("INVITATION_CREATE_FAILED");
        return { invitationId: result.invitationId, token: result.token };
      },
      async consumeInvitation(token, candidatePassword) {
        const result = await invitationService.consumeSuperAdminEditorInvitation(
          token,
          candidatePassword,
        );
        return result.ok;
      },
    };

    let passed = true;
    passed = await runScenario("check_rejects_editor_with_university", () =>
      testUserInsertAndRollback(pool, emailFor("check-reject"), universityId, true),
    ) && passed;
    passed = await runScenario("check_accepts_editor_without_university", () =>
      testUserInsertAndRollback(pool, emailFor("check-accept"), null, false),
    ) && passed;

    let successfulToken: string | undefined;
    const concurrentPassed = await runScenario("concurrent_consumption_once_only", async () => {
      const invitation = await context.createInvitation(emailFor("concurrent"));
      successfulToken = invitation.token;
      const results = await Promise.all([
        context.consumeInvitation(invitation.token, password),
        context.consumeInvitation(invitation.token, password),
      ]);
      const userCount = await countRows(pool, "users", emailFor("concurrent"));
      const acceptedResult = await pool.query<{ accepted_user_id: string | null }>(
        `SELECT accepted_user_id
         FROM public.super_admin_editor_invitations
         WHERE id = $1`,
        [invitation.invitationId],
      );
      return results.filter(Boolean).length === 1
        && userCount === 1
        && acceptedResult.rows[0]?.accepted_user_id !== null
        && acceptedResult.rows[0]?.accepted_user_id !== undefined;
    });
    passed = concurrentPassed && passed;

    passed = await runScenario("replay_refused", async () => {
      if (!successfulToken) return false;
      return !(await context.consumeInvitation(successfulToken, password));
    }) && passed;

    passed = await runScenario("expired_invitation_refused", async () => {
      const invitation = await context.createInvitation(emailFor("expired"));
      await pool.query(
        `UPDATE public.super_admin_editor_invitations
         SET expires_at = now() - interval '1 minute'
         WHERE id = $1`,
        [invitation.invitationId],
      );
      return !(await context.consumeInvitation(invitation.token, password));
    }) && passed;

    passed = await runScenario("reissue_invalidates_old_token", async () => {
      const email = emailFor("reissue");
      const first = await context.createInvitation(email);
      const second = await context.createInvitation(email);
      const oldInvitation = await pool.query<{ revoked_at: Date | null }>(
        `SELECT revoked_at
         FROM public.super_admin_editor_invitations
         WHERE id = $1`,
        [first.invitationId],
      );
      return oldInvitation.rows[0]?.revoked_at !== null
        && oldInvitation.rows[0]?.revoked_at !== undefined
        && !(await context.consumeInvitation(first.token, password))
        && (await countRows(pool, "super_admin_editor_invitations", email)) === 2
        && second.token !== first.token;
    }) && passed;

    passed = await runScenario("existing_account_rolls_back_consumption", async () => {
      const email = emailFor("existing");
      const invitation = await context.createInvitation(email);
      await pool.query(
        `INSERT INTO public.users (email, role, university_id)
         VALUES ($1, 'super_admin_editor', NULL)`,
        [email],
      );
      const consumed = await invitationService.consumeSuperAdminEditorInvitation(
        invitation.token,
        password,
      );
      const invitationState = await pool.query<{ consumed_at: Date | null }>(
        `SELECT consumed_at
         FROM public.super_admin_editor_invitations
         WHERE id = $1`,
        [invitation.invitationId],
      );
      return !consumed.ok
        && consumed.reason === "invitation_unavailable"
        && invitationState.rows[0]?.consumed_at === null;
    }) && passed;

    passed = await runScenario("revoke_by_id", async () => {
      const invitation = await context.createInvitation(emailFor("revoke"));
      const revoked = await invitationService.revokeSuperAdminEditorInvitation(
        invitation.invitationId,
      );
      return revoked && !(await context.consumeInvitation(invitation.token, password));
    }) && passed;

    return passed;
  } finally {
    await servicePool.end();
  }
}

async function main(): Promise<void> {
  if (!hasValidArguments()) {
    process.stdout.write("Usage: db:test-super-admin-editor [--apply]\n");
    process.exitCode = 1;
    return;
  }
  if (Object.hasOwn(process.env, "DATABASE_URL")) {
    process.stdout.write("KO DATABASE_URL_PREEXISTANTE\n");
    process.exitCode = 1;
    return;
  }

  let guarded: ReturnType<typeof openGuardedDatabase> | undefined;
  let cleanupAllowed = false;
  let cleanupEmailPattern: string | undefined;
  let failed = false;
  let stage = "guard";

  try {
    guarded = openGuardedDatabase();
    stage = "read_only";
    const snapshot = await readOnlySnapshot(guarded.pool);
    printReadOnlySnapshot(snapshot);

    if (isApplyMode()) {
      if (!snapshot.readyForApply) {
        process.stdout.write("KO apply_preconditions_not_met\n");
        failed = true;
      } else {
        stage = "marker_check";
        if (await markerEmailExists(guarded.pool)) {
          process.stdout.write("KO marker_email_already_exists\n");
          failed = true;
        } else {
          cleanupAllowed = true;
          const runId = randomUUID().replaceAll("-", "");
          cleanupEmailPattern = `integration-editor-${runId}-%@example.invalid`;
          stage = "apply_scenarios";
          failed = !(await runApplyScenarios(guarded.pool, runId));
        }
      }
    }
  } catch (error) {
    process.stdout.write(`KO ${stage} CODE=${safeDatabaseErrorCode(error)}\n`);
    failed = true;
  } finally {
    if (guarded && cleanupAllowed) {
      try {
        const invitations = await guarded.pool.query(
          `DELETE FROM public.super_admin_editor_invitations
           WHERE email LIKE $1`,
          [cleanupEmailPattern],
        );
        const users = await guarded.pool.query(
          `DELETE FROM public.users
           WHERE email LIKE $1`,
          [cleanupEmailPattern],
        );
        const remaining = await guarded.pool.query<{ users: string; invitations: string }>(
          `SELECT
             (SELECT count(*)::text FROM public.users
              WHERE email LIKE $1) AS users,
             (SELECT count(*)::text FROM public.super_admin_editor_invitations
              WHERE email LIKE $1) AS invitations`,
          [cleanupEmailPattern],
        );
        const remainingUsers = Number(remaining.rows[0]?.users ?? 0);
        const remainingInvitations = Number(remaining.rows[0]?.invitations ?? 0);
        const cleanupPassed = remainingUsers === 0 && remainingInvitations === 0;
        process.stdout.write(
          `${cleanupPassed ? "OK" : "KO"} cleanup deleted_invitations=${invitations.rowCount ?? 0}`
          + ` deleted_users=${users.rowCount ?? 0} remaining_invitations=${remainingInvitations}`
          + ` remaining_users=${remainingUsers}\n`,
        );
        if (!cleanupPassed) failed = true;
      } catch {
        process.stdout.write("KO cleanup\n");
        failed = true;
      }
    }

    try {
      await guarded?.pool.end();
    } catch {
      process.stdout.write("KO guarded_pool_close\n");
      failed = true;
    }
  }

  process.exitCode = failed ? 1 : 0;
}

if (process.argv[1]?.endsWith("test-super-admin-editor-invitations.ts")) {
  void main();
}
