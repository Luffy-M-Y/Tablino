export type UnlinkAdminGoogleStatus =
  | "user_not_found"
  | "user_not_unique"
  | "wrong_role"
  | "no_google_account"
  | "multiple_google_accounts"
  | "dry_run_ready"
  | "deleted";

export type UnlinkAdminGoogleResult = {
  status: UnlinkAdminGoogleStatus;
  googleAccountCount: number;
  providerAccountIdMasked?: string;
};

type QueryRow = Record<string, unknown>;

export type UnlinkAdminGoogleClient = {
  query(
    statement: string,
    values?: string[],
  ): Promise<{ rows: QueryRow[]; rowCount: number | null }>;
  release(): void;
};

export type UnlinkAdminGoogleArguments = {
  email: string;
  apply: boolean;
};

export function parseUnlinkAdminGoogleArguments(
  args: string[],
): UnlinkAdminGoogleArguments | null {
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

export function maskProviderAccountId(value: string): string {
  return value.length > 4 ? `****${value.slice(-4)}` : "****";
}

function decide(
  user: QueryRow | null,
  googleAccounts: QueryRow[],
  userCount: number,
): UnlinkAdminGoogleStatus {
  if (userCount === 0) return "user_not_found";
  if (userCount !== 1) return "user_not_unique";
  if (!user || user.role !== "university_admin") return "wrong_role";
  if (googleAccounts.length === 0) return "no_google_account";
  if (googleAccounts.length > 1) return "multiple_google_accounts";
  return "dry_run_ready";
}

export async function runUnlinkAdminGoogleAccount({
  email,
  apply,
  connect,
}: {
  email: string;
  apply: boolean;
  connect: () => Promise<UnlinkAdminGoogleClient>;
}): Promise<UnlinkAdminGoogleResult> {
  let client: UnlinkAdminGoogleClient | undefined;
  let transactionOpen = false;

  try {
    client = await connect();
    await client.query(apply ? "BEGIN" : "BEGIN READ ONLY");
    transactionOpen = true;

    const userQuery = await client.query(
      `SELECT id, role
       FROM users
       WHERE lower(email) = $1
       LIMIT 2${apply ? " FOR UPDATE" : ""}`,
      [email],
    );
    const user = userQuery.rows.length === 1 ? userQuery.rows[0] : null;

    let accountQuery: { rows: QueryRow[]; rowCount: number | null } = {
      rows: [],
      rowCount: 0,
    };
    if (user) {
      if (typeof user.id !== "string") throw new Error("INVALID_USER_ROW");
      accountQuery = await client.query(
        `SELECT id, provider_account_id
         FROM accounts
         WHERE user_id = $1
           AND provider = 'google'
         ORDER BY id${apply ? " FOR UPDATE" : ""}`,
        [user.id],
      );
    }

    const status = decide(user, accountQuery.rows, userQuery.rows.length);
    if (status !== "dry_run_ready") {
      if (apply) {
        await client.query("ROLLBACK");
      } else {
        await client.query("COMMIT");
      }
      transactionOpen = false;
      return { status, googleAccountCount: accountQuery.rows.length };
    }

    const account = accountQuery.rows[0];
    const userId = typeof user?.id === "string" ? user.id : null;
    if (
      userId === null
      || typeof account.id !== "string"
      || typeof account.provider_account_id !== "string"
    ) {
      throw new Error("INVALID_ACCOUNT_ROW");
    }
    const providerAccountIdMasked = maskProviderAccountId(account.provider_account_id);

    if (!apply) {
      await client.query("COMMIT");
      transactionOpen = false;
      return { status: "dry_run_ready", googleAccountCount: 1, providerAccountIdMasked };
    }

    const deletion = await client.query(
      `DELETE FROM accounts
       WHERE id = $1
         AND user_id = $2
         AND provider = 'google'
       RETURNING provider_account_id`,
      [account.id, userId],
    );
    if (deletion.rows.length !== 1 || deletion.rowCount !== 1) {
      throw new Error("DELETE_COUNT_MISMATCH");
    }

    await client.query("COMMIT");
    transactionOpen = false;
    return { status: "deleted", googleAccountCount: 1, providerAccountIdMasked };
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
