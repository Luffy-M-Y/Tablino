import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Pool, PoolClient } from "pg";
import { openGuardedDatabase } from "./_database-guard";

type ReadOnlySnapshot = {
  roleValues: string[];
  invitationTableExists: boolean;
  roleScopeCheck: string | null;
  singleSuperAdminIndex: boolean;
  superAdminProtectionTrigger: boolean;
  invitationRoleColumnAndCheck: boolean;
  superAdminEditorCount: number;
  superAdminLectorCount: number;
  superAdminCount: number;
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

function safeDatabaseErrorConstraint(error: unknown): string | null {
  if (
    typeof error !== "object"
    || error === null
    || !("constraint" in error)
    || typeof error.constraint !== "string"
  ) {
    return null;
  }
  return error.constraint;
}

function isInvitationRoleCheckValid(definition: string | null): boolean {
  if (definition === null || !definition.toLowerCase().includes("::text")) return false;
  const normalized = definition.toLowerCase().replaceAll('"', "").replace(/\s+/g, "");
  if (!/role\)?::text/.test(normalized)) return false;
  const literals = [...definition.matchAll(/'([^']*)'/g)].map((match) => match[1]);
  return literals.length === 2
    && literals.includes("super_admin_editor")
    && literals.includes("super_admin_lector");
}

function checkIsTextualRoleScope(definition: string | null): boolean {
  if (definition === null) return false;
  const normalized = definition.toLowerCase().replaceAll('"', "").replace(/\s+/g, "");
  const roleTextComparisons = normalized.match(/role\)?::text/g) ?? [];
  return roleTextComparisons.length >= 2
    && normalized.includes("'super_admin'")
    && normalized.includes("'super_admin_editor'")
    && normalized.includes("'super_admin_lector'")
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
    `SELECT to_regclass('public.admin_invitations') IS NOT NULL AS exists`,
  );
  const checkResult = await pool.query<{ definition: string | null }>(
    `SELECT pg_get_constraintdef(oid) AS definition
     FROM pg_constraint
     WHERE conrelid = 'public.users'::regclass
       AND conname = 'users_role_university_scope_check'`,
  );
  const indexResult = await pool.query<{
    is_unique: boolean;
    is_partial: boolean;
    predicate: string | null;
  }>(
    `SELECT
       i.indisunique AS is_unique,
       i.indpred IS NOT NULL AS is_partial,
       pg_get_expr(i.indpred, i.indrelid) AS predicate
     FROM pg_index i
     JOIN pg_class index_relation ON index_relation.oid = i.indexrelid
     WHERE i.indrelid = to_regclass('public.users')
       AND index_relation.relname = 'users_single_super_admin_uq'`,
  );
  const triggerResult = await pool.query<{
    enabled: string;
    protects_expected_function: boolean;
    is_before_row_update_delete: boolean;
  }>(
    `SELECT
       trigger_row.tgenabled AS enabled,
       trigger_row.tgfoid = to_regprocedure('public.protect_super_admin_identity()')
         AS protects_expected_function,
       (trigger_row.tgtype & 27) = 27 AS is_before_row_update_delete
     FROM pg_trigger trigger_row
     WHERE trigger_row.tgrelid = to_regclass('public.users')
       AND trigger_row.tgname = 'users_protect_super_admin_identity'
       AND NOT trigger_row.tgisinternal`,
  );
  const invitationRoleResult = await pool.query<{
    column_exists: boolean;
    column_is_role_not_null: boolean;
    role_check: string | null;
  }>(
    `SELECT
       EXISTS (
         SELECT 1
         FROM pg_attribute column_row
         WHERE column_row.attrelid = to_regclass('public.admin_invitations')
           AND column_row.attname = 'role'
           AND column_row.attnum > 0
           AND NOT column_row.attisdropped
       ) AS column_exists,
       EXISTS (
         SELECT 1
         FROM pg_attribute column_row
         JOIN pg_type role_type ON role_type.oid = column_row.atttypid
         JOIN pg_namespace role_schema ON role_schema.oid = role_type.typnamespace
         WHERE column_row.attrelid = to_regclass('public.admin_invitations')
           AND column_row.attname = 'role'
           AND column_row.attnum > 0
           AND NOT column_row.attisdropped
           AND column_row.attnotnull
           AND role_type.typname = 'role'
           AND role_schema.nspname = 'public'
       ) AS column_is_role_not_null,
       (
         SELECT pg_get_constraintdef(constraint_row.oid)
         FROM pg_constraint constraint_row
         WHERE constraint_row.conrelid = to_regclass('public.admin_invitations')
           AND constraint_row.conname = 'admin_invitations_role_check'
           AND constraint_row.contype = 'c'
         LIMIT 1
       ) AS role_check`,
  );
  const roleCountResult = await pool.query<{
    super_admin_editor: string;
    super_admin_lector: string;
    super_admin: string;
  }>(
    `SELECT
       count(*) FILTER (WHERE role::text = 'super_admin_editor')::text AS super_admin_editor,
       count(*) FILTER (WHERE role::text = 'super_admin_lector')::text AS super_admin_lector,
       count(*) FILTER (WHERE role::text = 'super_admin')::text AS super_admin
     FROM public.users`,
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
  const superAdminIndex = indexResult.rows[0];
  const normalizedIndexPredicate = superAdminIndex?.predicate
    ?.toLowerCase()
    .replaceAll('"', "")
    .replace(/\s+/g, "");
  const singleSuperAdminIndex = superAdminIndex?.is_unique === true
    && superAdminIndex.is_partial
    && (
      normalizedIndexPredicate?.includes("role='super_admin'::role") === true
      || normalizedIndexPredicate?.includes("users.role='super_admin'::role") === true
    );
  const protectionTrigger = triggerResult.rows[0];
  const superAdminProtectionTrigger = protectionTrigger !== undefined
    && (protectionTrigger.enabled === "O" || protectionTrigger.enabled === "A")
    && protectionTrigger.protects_expected_function
    && protectionTrigger.is_before_row_update_delete;
  const invitationRole = invitationRoleResult.rows[0];
  const invitationRoleColumnAndCheck = invitationRole?.column_exists === true
    && invitationRole.column_is_role_not_null
    && isInvitationRoleCheckValid(invitationRole.role_check);
  const roleCounts = roleCountResult.rows[0];
  const superAdminEditorCount = Number(roleCounts?.super_admin_editor ?? NaN);
  const superAdminLectorCount = Number(roleCounts?.super_admin_lector ?? NaN);
  const superAdminCount = Number(roleCounts?.super_admin ?? NaN);
  const readyForApply = roleValues.includes("super_admin")
    && roleValues.includes("super_admin_editor")
    && roleValues.includes("super_admin_lector")
    && tableResult.rows[0]?.exists === true
    && checkIsTextualRoleScope(roleScopeCheck)
    && singleSuperAdminIndex
    && superAdminProtectionTrigger
    && invitationRoleColumnAndCheck
    && superAdminEditorCount === 0
    && Number.isFinite(superAdminLectorCount)
    && superAdminCount === 1;

  return {
    roleValues,
    invitationTableExists: tableResult.rows[0]?.exists === true,
    roleScopeCheck,
    singleSuperAdminIndex,
    superAdminProtectionTrigger,
    invitationRoleColumnAndCheck,
    superAdminEditorCount,
    superAdminLectorCount,
    superAdminCount,
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
  process.stdout.write(
    `${snapshot.singleSuperAdminIndex ? "OK" : "ECHEC"} users_single_super_admin_uq\n`,
  );
  process.stdout.write(
    `${snapshot.superAdminProtectionTrigger ? "OK" : "ECHEC"} users_protect_super_admin_identity\n`,
  );
  process.stdout.write(
    `${snapshot.invitationRoleColumnAndCheck ? "OK" : "ECHEC"} admin_invitations_role_column_check\n`,
  );
  process.stdout.write(
    `${snapshot.superAdminEditorCount === 0 ? "OK" : "ECHEC"} super_admin_editor_count=${snapshot.superAdminEditorCount}\n`,
  );
  process.stdout.write(
    `${Number.isFinite(snapshot.superAdminLectorCount) ? "OK" : "ECHEC"} super_admin_lector_count=${snapshot.superAdminLectorCount}\n`,
  );
  process.stdout.write(
    `${snapshot.superAdminCount === 1 ? "OK" : "ECHEC"} super_admin_count=${snapshot.superAdminCount}\n`,
  );
  process.stdout.write(
    `${snapshot.readyForApply ? "OK" : "ECHEC"} READ_ONLY_PREREQUISITES\n`,
  );
}

async function markerEmailExists(pool: Pool): Promise<boolean> {
  const result = await pool.query<{ exists: boolean }>(
    `SELECT
       EXISTS (
         SELECT 1 FROM public.users
         WHERE email LIKE 'integration-reader-%@example.invalid'
       )
       OR EXISTS (
         SELECT 1 FROM public.admin_invitations
         WHERE email LIKE 'integration-reader-%@example.invalid'
       ) AS exists`,
  );
  return result.rows[0]?.exists === true;
}

async function testUserInsertAndRollback(
  pool: Pool,
  email: string,
  role: "super_admin_editor" | "super_admin_lector",
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
         VALUES ($1, $2, $3)`,
        [email, role, universityId],
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
  table: "users" | "admin_invitations",
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

async function inRollbackTransaction<T>(
  pool: Pool,
  run: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  let transactionStarted = false;
  try {
    await client.query("BEGIN");
    transactionStarted = true;
    return await run(client);
  } finally {
    try {
      if (transactionStarted) await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  }
}

async function triggerRejects(
  client: PoolClient,
  savepoint: string,
  statement: string,
  userId: string,
): Promise<boolean> {
  await client.query(`SAVEPOINT ${savepoint}`);
  let errorCode: string | null = null;
  try {
    await client.query(statement, [userId]);
  } catch (error) {
    errorCode = safeDatabaseErrorCode(error);
  }
  await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
  await client.query(`RELEASE SAVEPOINT ${savepoint}`);
  return errorCode === "P0001";
}

async function runSuperAdminProtectionScenarios(
  pool: Pool,
  superAdmin: { id: string; role: string; revoked_at: Date | null },
  duplicateEmail: string,
): Promise<boolean> {
  let passed = true;

  passed = await runScenario("trigger_blocks_super_admin_role_revocation_and_delete", () =>
    inRollbackTransaction(pool, async (client) => {
      const roleChangeBlocked = await triggerRejects(
        client,
        "protect_role_change",
        `UPDATE public.users
         SET role = 'super_admin_lector'
         WHERE id = $1`,
        superAdmin.id,
      );
      const revocationBlocked = await triggerRejects(
        client,
        "protect_revoked_at_change",
        `UPDATE public.users
         SET revoked_at = now()
         WHERE id = $1`,
        superAdmin.id,
      );
      const deletionBlocked = await triggerRejects(
        client,
        "protect_delete",
        `DELETE FROM public.users WHERE id = $1`,
        superAdmin.id,
      );
      return roleChangeBlocked && revocationBlocked && deletionBlocked;
    }),
  ) && passed;

  passed = await runScenario("operator_override_allows_protected_updates_then_rolls_back", async () => {
    const updatesSucceeded = await inRollbackTransaction(pool, async (client) => {
      await client.query(
        "SELECT set_config('tablino.operator_override', 'on', true)",
      );
      const revokedAtUpdate = await client.query(
        `UPDATE public.users
         SET revoked_at = now()
         WHERE id = $1`,
        [superAdmin.id],
      );
      const roleUpdate = await client.query(
        `UPDATE public.users
         SET role = 'super_admin_lector'
         WHERE id = $1`,
        [superAdmin.id],
      );
      return revokedAtUpdate.rowCount === 1 && roleUpdate.rowCount === 1;
    });
    const unchanged = await pool.query<{
      id: string;
      role: string;
      revoked_at: Date | null;
    }>(
      `SELECT id, role::text AS role, revoked_at
       FROM public.users
       WHERE id = $1`,
      [superAdmin.id],
    );
    const restored = unchanged.rows[0];
    return updatesSucceeded
      && restored?.id === superAdmin.id
      && restored.role === superAdmin.role
      && restored.revoked_at?.getTime() === superAdmin.revoked_at?.getTime();
  }) && passed;

  passed = await runScenario("single_super_admin_index_rejects_second_super_admin", () =>
    inRollbackTransaction(pool, async (client) => {
      try {
        await client.query(
          `INSERT INTO public.users (email, role, university_id)
           VALUES ($1, 'super_admin', NULL)`,
          [duplicateEmail],
        );
        return false;
      } catch (error) {
        return safeDatabaseErrorCode(error) === "23505"
          && safeDatabaseErrorConstraint(error) === "users_single_super_admin_uq";
      }
    }),
  ) && passed;

  return passed;
}

async function runApplyScenarios(pool: Pool, runId: string): Promise<boolean> {
  const superAdminResult = await pool.query<{
    id: string;
    role: string;
    revoked_at: Date | null;
  }>(
    `SELECT id, role::text AS role, revoked_at
     FROM public.users
     WHERE role::text = 'super_admin'`,
  );
  const superAdmin = superAdminResult.rows.length === 1
    ? superAdminResult.rows[0]
    : null;
  const inviterId = superAdmin?.id ?? null;
  const inviterCountPassed = superAdmin !== null;
  process.stdout.write(`${inviterCountPassed ? "OK" : "KO"} exactly_one_super_admin_inviter\n`);
  if (!inviterId || !superAdmin) return false;

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
    const invitationService = await import("../src/admin-invitation");
    const emailFor = (label: string) =>
      `integration-reader-${runId}-${label}@example.invalid`;
    const context: ScenarioContext = {
      async createInvitation(email) {
        const result = await invitationService.createAdminInvitation(email, inviterId);
        if (!result.ok) throw new Error("INVITATION_CREATE_FAILED");
        return { invitationId: result.invitationId, token: result.token };
      },
      async consumeInvitation(token, candidatePassword) {
        const result = await invitationService.consumeAdminInvitation(
          token,
          candidatePassword,
        );
        return result.ok;
      },
    };

    let passed = true;
    passed = await runSuperAdminProtectionScenarios(
      pool,
      superAdmin,
      `integration-reader-${runId}-second-super-admin@example.invalid`,
    ) && passed;
    passed = await runScenario("check_rejects_editor_with_university", () =>
      testUserInsertAndRollback(pool, emailFor("editor-check-reject"), "super_admin_editor", universityId, true),
    ) && passed;
    passed = await runScenario("check_rejects_lector_with_university", () =>
      testUserInsertAndRollback(pool, emailFor("lector-check-reject"), "super_admin_lector", universityId, true),
    ) && passed;
    passed = await runScenario("check_accepts_editor_without_university", () =>
      testUserInsertAndRollback(pool, emailFor("editor-check-accept"), "super_admin_editor", null, false),
    ) && passed;
    passed = await runScenario("check_accepts_lector_without_university", () =>
      testUserInsertAndRollback(pool, emailFor("lector-check-accept"), "super_admin_lector", null, false),
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
      const acceptedResult = await pool.query<{ accepted_user_id: string | null; role: string }>(
        `SELECT accepted_user_id, role
         FROM public.admin_invitations
         WHERE id = $1`,
        [invitation.invitationId],
      );
      const acceptedUserId = acceptedResult.rows[0]?.accepted_user_id;
      if (!acceptedUserId) return false;
      const acceptedUser = await pool.query<{ role: string }>(
        `SELECT role FROM public.users WHERE id = $1`,
        [acceptedUserId],
      );
      return results.filter(Boolean).length === 1
        && userCount === 1
        && acceptedResult.rows[0]?.accepted_user_id !== null
        && acceptedResult.rows[0]?.accepted_user_id !== undefined
        && acceptedResult.rows[0]?.role === "super_admin_lector"
        && acceptedUser.rows[0]?.role === "super_admin_lector";
    });
    passed = concurrentPassed && passed;

    passed = await runScenario("replay_refused", async () => {
      if (!successfulToken) return false;
      return !(await context.consumeInvitation(successfulToken, password));
    }) && passed;

    passed = await runScenario("expired_invitation_refused", async () => {
      const invitation = await context.createInvitation(emailFor("expired"));
      await pool.query(
        `UPDATE public.admin_invitations
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
         FROM public.admin_invitations
         WHERE id = $1`,
        [first.invitationId],
      );
      return oldInvitation.rows[0]?.revoked_at !== null
        && oldInvitation.rows[0]?.revoked_at !== undefined
        && !(await context.consumeInvitation(first.token, password))
        && (await countRows(pool, "admin_invitations", email)) === 2
        && second.token !== first.token;
    }) && passed;

    passed = await runScenario("existing_account_rolls_back_consumption", async () => {
      const email = emailFor("existing");
      const invitation = await context.createInvitation(email);
      await pool.query(
        `INSERT INTO public.users (email, role, university_id)
         VALUES ($1, 'super_admin_lector', NULL)`,
        [email],
      );
      const consumed = await invitationService.consumeAdminInvitation(
        invitation.token,
        password,
      );
      const invitationState = await pool.query<{ consumed_at: Date | null }>(
        `SELECT consumed_at
         FROM public.admin_invitations
         WHERE id = $1`,
        [invitation.invitationId],
      );
      return !consumed.ok
        && consumed.reason === "invitation_unavailable"
        && invitationState.rows[0]?.consumed_at === null;
    }) && passed;

    passed = await runScenario("revoke_by_id", async () => {
      const invitation = await context.createInvitation(emailFor("revoke"));
      const revoked = await invitationService.revokeAdminInvitation(
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
    process.stdout.write("Usage: db:test-admin-invitations [--apply]\n");
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
    if (!snapshot.readyForApply) failed = true;

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
          cleanupEmailPattern = `integration-reader-${runId}-%@example.invalid`;
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
          `DELETE FROM public.admin_invitations
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
             (SELECT count(*)::text FROM public.admin_invitations
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

if (process.argv[1]?.endsWith("test-admin-invitations.ts")) {
  void main();
}
