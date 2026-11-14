import { maskDiagnosticEmail } from "./diagnose-admin-google-account";

type QueryRow = Record<string, unknown>;

export type SetSuperAdminPasswordClient = {
  query(
    statement: string,
    values?: unknown[],
  ): Promise<{ rows: QueryRow[]; rowCount: number | null }>;
  release(): void;
};

export type SetSuperAdminPasswordArguments = {
  email: string;
  apply: boolean;
};

export type SuperAdminEligibilityStatus =
  | "user_not_found"
  | "user_not_unique"
  | "wrong_role"
  | "email_not_verified"
  | "revoked"
  | "password_exists"
  | "eligible"
  | "invalid_user_row";

export type SetSuperAdminPasswordResult = {
  status: SuperAdminEligibilityStatus | "dry_run_ready" | "updated";
  rowsModified: number;
  sessionsDeleted: number;
};

const RESULT_CODES: Record<SetSuperAdminPasswordResult["status"], string> = {
  user_not_found: "UTILISATEUR_ABSENT",
  user_not_unique: "UTILISATEUR_NON_UNIQUE",
  wrong_role: "ROLE_REFUSE",
  email_not_verified: "EMAIL_NON_VERIFIE",
  revoked: "UTILISATEUR_REVOQUE",
  password_exists: "MOT_DE_PASSE_PRESENT_UTILISER_REINITIALISATION",
  eligible: "ELIGIBILITE_VALIDEE",
  invalid_user_row: "UTILISATEUR_INVALIDE",
  dry_run_ready: "SIMULATION_PRETE",
  updated: "MOT_DE_PASSE_DEFINI",
};

export function parseSetSuperAdminPasswordArguments(
  args: string[],
): SetSuperAdminPasswordArguments | null {
  const applyCount = args.filter((arg) => arg === "--apply").length;
  if (applyCount > 1) return null;

  const positional = args.filter((arg) => arg !== "--apply");
  if (positional.length !== 1 || positional[0].startsWith("-")) return null;

  const email = positional[0].trim().toLowerCase();
  if (
    email.length > 255
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return null;
  }

  return { email, apply: applyCount === 1 };
}

export function decideSuperAdminEligibility(
  rows: QueryRow[],
): { status: SuperAdminEligibilityStatus; userId?: string } {
  if (rows.length === 0) return { status: "user_not_found" };
  if (rows.length !== 1) return { status: "user_not_unique" };

  const user = rows[0];
  if (typeof user.id !== "string" || typeof user.role !== "string"
      || typeof user.email_verified !== "boolean"
      || typeof user.not_revoked !== "boolean"
      || typeof user.password_missing !== "boolean") {
    return { status: "invalid_user_row" };
  }
  if (user.role !== "super_admin") return { status: "wrong_role" };
  if (!user.email_verified) return { status: "email_not_verified" };
  if (!user.not_revoked) return { status: "revoked" };
  if (!user.password_missing) return { status: "password_exists" };
  const userId = user.id;
  return { status: "eligible", userId };
}

export function formatSetSuperAdminPasswordResult(
  email: string,
  result: SetSuperAdminPasswordResult,
): string {
  return `EMAIL=${maskDiagnosticEmail(email)} RESULT=${RESULT_CODES[result.status]}`
    + ` ROWS_MODIFIED=${result.rowsModified} SESSIONS_DELETED=${result.sessionsDeleted}`;
}

export async function runSetSuperAdminPassword({
  email,
  apply,
  queryEligibility,
  connect,
  getPasswordHash,
}: {
  email: string;
  apply: boolean;
  queryEligibility: (statement: string, values: unknown[]) =>
    Promise<{ rows: QueryRow[]; rowCount: number | null }>;
  connect: () => Promise<SetSuperAdminPasswordClient>;
  getPasswordHash?: () => Promise<string>;
}): Promise<SetSuperAdminPasswordResult> {
  const eligibilityQuery = await queryEligibility(
    `SELECT
       id,
       role,
       email_verified IS NOT NULL AS email_verified,
       revoked_at IS NULL AS not_revoked,
       password_hash IS NULL AS password_missing
     FROM users
     WHERE lower(email) = $1
     LIMIT 2`,
    [email],
  );
  const eligibility = decideSuperAdminEligibility(eligibilityQuery.rows);
  if (eligibility.status !== "eligible") {
    return { status: eligibility.status, rowsModified: 0, sessionsDeleted: 0 };
  }
  if (!apply) {
    return { status: "dry_run_ready", rowsModified: 0, sessionsDeleted: 0 };
  }
  if (!getPasswordHash) throw new Error("PASSWORD_INPUT_REQUIRED");

  const passwordHash = await getPasswordHash();
  if (typeof passwordHash !== "string" || passwordHash.length === 0) {
    throw new Error("INVALID_PASSWORD_HASH");
  }

  let client: SetSuperAdminPasswordClient | undefined;
  let transactionOpen = false;
  try {
    client = await connect();
    await client.query("BEGIN");
    transactionOpen = true;

    const lockedUsers = await client.query(
      `SELECT
         id,
         role,
         email_verified IS NOT NULL AS email_verified,
         revoked_at IS NULL AS not_revoked,
         password_hash IS NULL AS password_missing
       FROM users
       WHERE lower(email) = $1
       LIMIT 2
       FOR UPDATE`,
      [email],
    );
    const lockedEligibility = decideSuperAdminEligibility(lockedUsers.rows);
    if (lockedEligibility.status !== "eligible") {
      await client.query("ROLLBACK");
      transactionOpen = false;
      return {
        status: lockedEligibility.status,
        rowsModified: 0,
        sessionsDeleted: 0,
      };
    }

    const update = await client.query(
      `UPDATE users
       SET password_hash = $1
       WHERE id = $2
         AND role = 'super_admin'
         AND email_verified IS NOT NULL
         AND revoked_at IS NULL
         AND password_hash IS NULL
       RETURNING id`,
      [passwordHash, lockedEligibility.userId],
    );
    if (update.rows.length !== 1 || update.rowCount !== 1) {
      throw new Error("UPDATE_COUNT_MISMATCH");
    }

    const deletion = await client.query(
      "DELETE FROM sessions WHERE user_id = $1 RETURNING id",
      [lockedEligibility.userId],
    );
    if (
      deletion.rowCount === null
      || deletion.rowCount !== deletion.rows.length
    ) {
      throw new Error("SESSION_DELETE_COUNT_MISMATCH");
    }

    await client.query("COMMIT");
    transactionOpen = false;
    return {
      status: "updated",
      rowsModified: 1,
      sessionsDeleted: deletion.rows.length,
    };
  } catch (error) {
    if (transactionOpen) {
      try {
        await client?.query("ROLLBACK");
      } catch {
        throw new Error("ROLLBACK_FAILED");
      }
    }
    throw error;
  } finally {
    client?.release();
  }
}
