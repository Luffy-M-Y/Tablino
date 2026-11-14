import { normalizeEmail } from "./_provisioning";
import { openGuardedDatabase } from "./_database-guard";

type UserRow = {
  id: string;
  role: string;
  university_id: string | null;
  email_verified: Date | string | null;
  password_hash_present: boolean;
  revoked_at: Date | string | null;
};

type AccountRow = {
  provider: string;
  provider_account_id: string;
  created_at: Date | string | null;
};

function formatDate(value: Date | string | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function maskProviderAccountId(value: string): string {
  return `****${value.slice(-4)}`;
}

async function main(): Promise<void> {
  if (Object.hasOwn(process.env, "DATABASE_URL")) {
    process.stdout.write("ECHEC DATABASE_URL_PREEXISTANTE\n");
    process.exitCode = 1;
    return;
  }

  let email: string;
  try {
    email = normalizeEmail(process.argv[2]);
  } catch {
    process.stdout.write("ECHEC ARGUMENT_EMAIL_INVALIDE\n");
    process.exitCode = 1;
    return;
  }

  let database: ReturnType<typeof openGuardedDatabase> | undefined;
  let stage = "garde";
  try {
    database = openGuardedDatabase();
    stage = "lecture_utilisateur";
    const userResult = await database.pool.query<UserRow>(
      `SELECT
         id,
         role,
         university_id,
         email_verified,
         password_hash IS NOT NULL AS password_hash_present,
         revoked_at
       FROM users
       WHERE lower(email) = $1
       LIMIT 2`,
      [email],
    );
    if (userResult.rows.length !== 1) {
      throw new Error(userResult.rows.length === 0 ? "USER_NOT_FOUND" : "USER_NOT_UNIQUE");
    }

    const user = userResult.rows[0];
    stage = "lecture_colonne_accounts";
    const createdAtColumnResult = await database.pool.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1
         FROM information_schema.columns
         WHERE table_schema = current_schema()
           AND table_name = 'accounts'
           AND column_name = 'created_at'
       ) AS exists`,
    );
    const hasAccountCreatedAt = createdAtColumnResult.rows[0]?.exists === true;

    stage = "lecture_accounts";
    const accountResult = await database.pool.query<AccountRow>(
      `SELECT
         provider,
         provider_account_id,
         ${hasAccountCreatedAt ? "created_at" : "NULL::timestamptz AS created_at"}
       FROM accounts
       WHERE user_id = $1
       ORDER BY provider`,
      [user.id],
    );

    stage = "lecture_sessions";
    const sessionResult = await database.pool.query<{ active_sessions: string }>(
      `SELECT count(*)::text AS active_sessions
       FROM sessions
       WHERE user_id = $1
         AND expires > now()`,
      [user.id],
    );

    process.stdout.write(`${JSON.stringify({
      user: {
        role: user.role,
        universityId: user.university_id,
        emailVerified: formatDate(user.email_verified),
        passwordHashPresent: user.password_hash_present,
        revokedAt: formatDate(user.revoked_at),
      },
      accounts: accountResult.rows.map((account) => ({
        provider: account.provider,
        createdAt: formatDate(account.created_at),
        providerAccountIdMasked: maskProviderAccountId(account.provider_account_id),
      })),
      accountCreatedAtColumnPresent: hasAccountCreatedAt,
      activeSessions: Number(sessionResult.rows[0]?.active_sessions ?? 0),
    })}\n`);
  } catch (error) {
    const code = (error as { code?: unknown; message?: unknown })?.code
      ?? (error as { message?: unknown })?.message;
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

void main();
