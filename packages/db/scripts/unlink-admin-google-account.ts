import { openGuardedDatabase } from "./_database-guard";
import {
  parseUnlinkAdminGoogleArguments,
  runUnlinkAdminGoogleAccount,
} from "./unlink-admin-google-account-core";

const STATUS_MESSAGES: Record<string, string> = {
  user_not_found: "UTILISATEUR_ABSENT",
  user_not_unique: "UTILISATEUR_NON_UNIQUE",
  wrong_role: "ROLE_REFUSE",
  no_google_account: "AUCUN_COMPTE_GOOGLE",
  multiple_google_accounts: "PLUSIEURS_COMPTES_GOOGLE",
  dry_run_ready: "SUPPRESSION_SIMULEE",
  deleted: "SUPPRESSION_EFFECTUEE",
};

async function main(): Promise<void> {
  if (Object.hasOwn(process.env, "DATABASE_URL")) {
    process.stdout.write("ECHEC DATABASE_URL_PREEXISTANTE\n");
    process.exitCode = 1;
    return;
  }

  const args = parseUnlinkAdminGoogleArguments(process.argv.slice(2));
  if (!args) {
    process.stdout.write("ECHEC ARGUMENTS_INVALIDES\n");
    process.exitCode = 1;
    return;
  }

  let database: ReturnType<typeof openGuardedDatabase> | undefined;
  let stage = "garde";
  try {
    database = openGuardedDatabase();
    const pool = database.pool;
    stage = "transaction";
    const result = await runUnlinkAdminGoogleAccount({
      email: args.email,
      apply: args.apply,
      connect: async () => {
        const client = await pool.connect();
        return {
          query: async (statement, values) => {
            const queryResult = await client.query(statement, values);
            return { rows: queryResult.rows, rowCount: queryResult.rowCount };
          },
          release: () => client.release(),
        };
      },
    });

    const mode = args.apply ? "APPLY" : "DRY_RUN";
    process.stdout.write(
      `${mode} RESULT=${STATUS_MESSAGES[result.status]} GOOGLE_ACCOUNTS=${result.googleAccountCount}`,
    );
    if (result.providerAccountIdMasked) {
      process.stdout.write(` PROVIDER=google PROVIDER_ACCOUNT_ID=${result.providerAccountIdMasked}`);
    } else if (result.status === "dry_run_ready") {
      process.stdout.write(" PROVIDER=google");
    }
    process.stdout.write("\n");
    if (!["dry_run_ready", "deleted"].includes(result.status)) process.exitCode = 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const code = [
      "ROLLBACK_FAILED",
      "DELETE_COUNT_MISMATCH",
      "INVALID_USER_ROW",
      "INVALID_ACCOUNT_ROW",
    ].includes(message)
      ? message
      : "DB_OPERATION_FAILED";
    process.stdout.write(`ECHEC DESASSOCIATION ETAPE=${stage} CODE=${code}\n`);
    process.exitCode = 1;
  } finally {
    await database?.pool.end().catch(() => {
      process.stdout.write("ECHEC FERMETURE_POOL\n");
      process.exitCode = 1;
    });
  }
}

void main();
