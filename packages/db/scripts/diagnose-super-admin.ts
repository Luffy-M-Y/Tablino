import { openGuardedDatabase } from "./_database-guard";
import { maskDiagnosticEmail } from "./diagnose-admin-google-account";

type SuperAdminRow = {
  email: string;
  password_present: boolean;
  email_verified: boolean;
  account_linked: boolean;
  revoked: boolean;
  active_sessions: string;
};

export function formatSuperAdminDiagnostics(rows: SuperAdminRow[]) {
  return {
    superAdminCount: rows.length,
    superAdmins: rows.map((row) => ({
      emailMasked: maskDiagnosticEmail(row.email),
      passwordPresent: row.password_present,
      emailVerified: row.email_verified,
      accountLinked: row.account_linked,
      revoked: row.revoked,
      activeSessions: Number(row.active_sessions),
    })),
  };
}

async function main(): Promise<void> {
  if (Object.hasOwn(process.env, "DATABASE_URL")) {
    process.stdout.write("ECHEC DATABASE_URL_PREEXISTANTE\n");
    process.exitCode = 1;
    return;
  }

  let database: ReturnType<typeof openGuardedDatabase> | undefined;
  let stage = "garde";
  try {
    database = openGuardedDatabase();
    stage = "lecture_super_admin";
    const result = await database.pool.query<SuperAdminRow>(
      `SELECT
         users.email,
         users.password_hash IS NOT NULL AS password_present,
         users.email_verified IS NOT NULL AS email_verified,
         EXISTS (
           SELECT 1
           FROM accounts
           WHERE accounts.user_id = users.id
         ) AS account_linked,
         users.revoked_at IS NOT NULL AS revoked,
         (
           SELECT count(*)::text
           FROM sessions
           WHERE sessions.user_id = users.id
             AND sessions.expires > now()
         ) AS active_sessions
       FROM users
       WHERE users.role = 'super_admin'
       ORDER BY lower(users.email)`,
    );

    process.stdout.write(`${JSON.stringify(formatSuperAdminDiagnostics(result.rows))}\n`);
  } catch (error) {
    const code = (error as { code?: unknown })?.code;
    const safeCode = typeof code === "string" && /^[A-Z0-9_]+$/.test(code)
      ? code
      : "INCONNU";
    process.stdout.write(`ECHEC DIAGNOSTIC_LECTURE ETAPE=${stage} CODE=${safeCode}\n`);
    process.exitCode = 1;
  } finally {
    await database?.pool.end().catch(() => {
      process.stdout.write("ECHEC FERMETURE_POOL\n");
      process.exitCode = 1;
    });
  }
}

if (process.argv[1]?.endsWith("diagnose-super-admin.ts")) {
  void main();
}
