import assert from "node:assert/strict";
import test from "node:test";
import {
  decideSuperAdminEligibility,
  formatSetSuperAdminPasswordResult,
  parseSetSuperAdminPasswordArguments,
  runSetSuperAdminPassword,
  type SetSuperAdminPasswordClient,
} from "../scripts/set-super-admin-password-core";

type Row = Record<string, unknown>;
type MockOptions = {
  preflightRows?: Row[];
  lockedRows?: Row[];
  updateRows?: Row[];
  updateRowCount?: number | null;
  sessionRows?: Row[];
  sessionRowCount?: number | null;
  failUpdate?: boolean;
  failRollback?: boolean;
};

function eligibleUser(overrides: Row = {}): Row {
  return {
    id: "private-user-id",
    role: "super_admin",
    email_verified: true,
    not_revoked: true,
    password_missing: true,
    ...overrides,
  };
}

function createMock(options: MockOptions = {}) {
  const statements: Array<{ statement: string; values?: unknown[] }> = [];
  let released = false;
  const client: SetSuperAdminPasswordClient = {
    async query(statement, values) {
      statements.push({ statement, values });
      if (statement === "BEGIN") return { rows: [], rowCount: null };
      if (statement === "ROLLBACK" && options.failRollback) {
        throw new Error("rollback failure");
      }
      if (statement.startsWith("SELECT") && statement.includes("FOR UPDATE")) {
        return { rows: options.lockedRows ?? [eligibleUser()], rowCount: 1 };
      }
      if (statement.startsWith("UPDATE users")) {
        if (options.failUpdate) throw new Error("database failure");
        const rows = options.updateRows ?? [{ id: "private-user-id" }];
        return { rows, rowCount: options.updateRowCount ?? rows.length };
      }
      if (statement.startsWith("DELETE FROM sessions")) {
        const rows = options.sessionRows ?? [{ id: "private-session-id" }];
        return { rows, rowCount: options.sessionRowCount ?? rows.length };
      }
      return { rows: [], rowCount: null };
    },
    release() {
      released = true;
    },
  };
  return {
    statements,
    client,
    get released() {
      return released;
    },
  };
}

function run(options: MockOptions = {}, apply = true) {
  const mock = createMock(options);
  const sequence: string[] = [];
  return {
    mock,
    sequence,
    promise: runSetSuperAdminPassword({
      email: "admin@example.com",
      apply,
      queryEligibility: async (statement) => {
        sequence.push("preflight");
        assert.ok(!statement.includes("FOR UPDATE"));
        return { rows: options.preflightRows ?? [eligibleUser()], rowCount: 1 };
      },
      connect: async () => {
        sequence.push("connect");
        return mock.client;
      },
      getPasswordHash: async () => {
        sequence.push("password");
        return "private-hash";
      },
    }),
  };
}

test("parse les arguments, normalise l'e-mail et utilise dry-run par défaut", () => {
  assert.deepEqual(parseSetSuperAdminPasswordArguments([" Admin@Example.com "]), {
    email: "admin@example.com",
    apply: false,
  });
  assert.equal(
    formatSetSuperAdminPasswordResult("admin@example.com", {
      status: "dry_run_ready",
      rowsModified: 0,
      sessionsDeleted: 0,
    }),
    "EMAIL=a***@e***.com RESULT=SIMULATION_PRETE ROWS_MODIFIED=0 SESSIONS_DELETED=0",
  );
});

test("n'active apply qu'avec un seul drapeau explicite", () => {
  assert.deepEqual(parseSetSuperAdminPasswordArguments(["admin@example.com", "--apply"]), {
    email: "admin@example.com",
    apply: true,
  });
  assert.equal(parseSetSuperAdminPasswordArguments([]), null);
  assert.equal(parseSetSuperAdminPasswordArguments(["admin@example.com", "--apply", "--apply"]), null);
  assert.equal(parseSetSuperAdminPasswordArguments(["admin@example.com", "--other"]), null);
});

test("dry-run retourne l'éligibilité sans demander de mot de passe ni ouvrir de transaction", async () => {
  const { mock, sequence, promise } = run({}, false);
  assert.deepEqual(await promise, {
    status: "dry_run_ready",
    rowsModified: 0,
    sessionsDeleted: 0,
  });
  assert.deepEqual(sequence, ["preflight"]);
  assert.deepEqual(mock.statements, []);
});

test("refuse un utilisateur absent ou non unique", () => {
  assert.equal(decideSuperAdminEligibility([]).status, "user_not_found");
  assert.equal(decideSuperAdminEligibility([eligibleUser(), eligibleUser()]).status, "user_not_unique");
});

test("refuse un rôle autre que super_admin", () => {
  assert.equal(decideSuperAdminEligibility([eligibleUser({ role: "university_admin" })]).status, "wrong_role");
});

test("refuse un e-mail non vérifié", () => {
  assert.equal(decideSuperAdminEligibility([eligibleUser({ email_verified: false })]).status, "email_not_verified");
});

test("refuse un compte révoqué", () => {
  assert.equal(decideSuperAdminEligibility([eligibleUser({ not_revoked: false })]).status, "revoked");
});

test("refuse si un mot de passe existe déjà", () => {
  assert.equal(decideSuperAdminEligibility([eligibleUser({ password_missing: false })]).status, "password_exists");
});

test("demande et hache le mot de passe avant de connecter puis revérifie sous verrou", async () => {
  const { mock, sequence, promise } = run();
  assert.deepEqual(await promise, {
    status: "updated",
    rowsModified: 1,
    sessionsDeleted: 1,
  });
  assert.deepEqual(sequence, ["preflight", "password", "connect"]);
  assert.equal(mock.statements[0].statement, "BEGIN");
  assert.match(mock.statements[1].statement, /FOR UPDATE/);
  assert.match(mock.statements[2].statement, /^UPDATE users/);
  assert.match(mock.statements[2].statement, /SET password_hash = \$1/);
  assert.deepEqual(mock.statements[2].values, ["private-hash", "private-user-id"]);
  assert.match(mock.statements[3].statement, /^DELETE FROM sessions/);
  assert.equal(mock.statements.at(-1)?.statement, "COMMIT");
  assert.equal(mock.released, true);
});

test("annule sans écrire si les gardes changent entre le précontrôle et le verrou", async () => {
  const { mock, promise } = run({
    lockedRows: [eligibleUser({ revoked_at: true, not_revoked: false })],
  });
  assert.deepEqual(await promise, {
    status: "revoked",
    rowsModified: 0,
    sessionsDeleted: 0,
  });
  assert.equal(mock.statements.some(({ statement }) => statement.startsWith("UPDATE")), false);
  assert.equal(mock.statements.at(-1)?.statement, "ROLLBACK");
  assert.equal(mock.released, true);
});

test("rollback sur un nombre de lignes inattendu et libère le client", async () => {
  for (const options of [
    { updateRows: [], updateRowCount: 0 },
    { sessionRows: [{ id: "private-session-id" }], sessionRowCount: 2 },
  ]) {
    const { mock, promise } = run(options);
    await assert.rejects(
      promise,
      { message: options.updateRows ? "UPDATE_COUNT_MISMATCH" : "SESSION_DELETE_COUNT_MISMATCH" },
    );
    assert.equal(mock.statements.at(-1)?.statement, "ROLLBACK");
    assert.equal(mock.released, true);
  }
});

test("signale ROLLBACK_FAILED si le rollback échoue et libère le client", async () => {
  const { mock, promise } = run({
    failUpdate: true,
    failRollback: true,
  });
  await assert.rejects(promise, { message: "ROLLBACK_FAILED" });
  assert.equal(mock.released, true);
});
