import { openGuardedDatabase } from "./_database-guard";
import { readHiddenPassword } from "./_hidden-password";
import { isPasswordValid, hashPassword } from "../src/password";
import { normalizeEmail } from "./_provisioning";
import {
  formatSetSuperAdminPasswordResult,
  parseSetSuperAdminPasswordArguments,
  runSetSuperAdminPassword,
} from "./set-super-admin-password-core";

async function readNewPasswordHash(): Promise<string> {
  let password: string;
  let confirmation: string;
  try {
    password = await readHiddenPassword("Mot de passe super_admin : ");
    confirmation = await readHiddenPassword("Confirmez le mot de passe : ");
  } catch {
    throw new Error("PASSWORD_INPUT_FAILED");
  }
  if (!isPasswordValid(password)) throw new Error("PASSWORD_INVALID");
  if (password !== confirmation) throw new Error("PASSWORD_CONFIRMATION_MISMATCH");
  return hashPassword(password);
}

async function main(): Promise<void> {
  if (Object.hasOwn(process.env, "DATABASE_URL")) {
    process.stdout.write("ECHEC DATABASE_URL_PREEXISTANTE\n");
    process.exitCode = 1;
    return;
  }

  const parsed = parseSetSuperAdminPasswordArguments(process.argv.slice(2));
  if (!parsed) {
    process.stdout.write("ECHEC ARGUMENTS_INVALIDES\n");
    process.exitCode = 1;
    return;
  }

  let email: string;
  try {
    email = normalizeEmail(parsed.email);
  } catch {
    process.stdout.write("ECHEC ARGUMENTS_INVALIDES\n");
    process.exitCode = 1;
    return;
  }

  let database: ReturnType<typeof openGuardedDatabase> | undefined;
  let stage = "garde";
  try {
    database = openGuardedDatabase();
    stage = "lecture_eligibilite";
    const result = await runSetSuperAdminPassword({
      email,
      apply: parsed.apply,
      queryEligibility: async (statement, values) => {
        const queryResult = await database!.pool.query(statement, values);
        return { rows: queryResult.rows, rowCount: queryResult.rowCount };
      },
      connect: async () => {
        const client = await database!.pool.connect();
        return {
          query: async (statement, values) => {
            const queryResult = await client.query(statement, values);
            return { rows: queryResult.rows, rowCount: queryResult.rowCount };
          },
          release: () => client.release(),
        };
      },
      getPasswordHash: readNewPasswordHash,
    });

    process.stdout.write(`${formatSetSuperAdminPasswordResult(email, result)}\n`);
    if (result.status !== "dry_run_ready" && result.status !== "updated") {
      process.exitCode = 1;
    }
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const safeCode = [
      "ROLLBACK_FAILED",
      "UPDATE_COUNT_MISMATCH",
      "SESSION_DELETE_COUNT_MISMATCH",
      "PASSWORD_INPUT_REQUIRED",
      "INVALID_PASSWORD_HASH",
      "PASSWORD_INPUT_FAILED",
      "PASSWORD_INVALID",
      "PASSWORD_CONFIRMATION_MISMATCH",
    ].includes(code)
      ? code
      : "DB_OPERATION_FAILED";
    process.stdout.write(`ECHEC MISE_A_JOUR_SUPER_ADMIN ETAPE=${stage} CODE=${safeCode}\n`);
    process.exitCode = 1;
  } finally {
    await database?.pool.end().catch(() => {
      process.stdout.write("ECHEC FERMETURE_POOL\n");
      process.exitCode = 1;
    });
  }
}

void main();
