import assert from "node:assert/strict";
import test from "node:test";
import {
  maskProviderAccountId,
  parseUnlinkAdminGoogleArguments,
  runUnlinkAdminGoogleAccount,
  type UnlinkAdminGoogleClient,
} from "../scripts/unlink-admin-google-account-core";

type MockState = {
  userRows: Record<string, unknown>[];
  accountRows: Record<string, unknown>[];
  deleteRows?: Record<string, unknown>[];
  deleteRowCount?: number | null;
  failDelete?: boolean;
  failRollback?: boolean;
};

function createMockClient(state: MockState) {
  const statements: Array<{ statement: string; values?: string[] }> = [];
  let released = false;
  const client: UnlinkAdminGoogleClient = {
    async query(statement, values) {
      statements.push({ statement, values });
      if (statement.startsWith("SELECT id, role")) {
        return { rows: state.userRows, rowCount: state.userRows.length };
      }
      if (statement.startsWith("SELECT id, provider_account_id")) {
        return { rows: state.accountRows, rowCount: state.accountRows.length };
      }
      if (statement.startsWith("DELETE FROM accounts")) {
        if (state.failDelete) throw new Error("database failure");
        const rows = state.deleteRows ?? [{ provider_account_id: "google-account-1234" }];
        return { rows, rowCount: state.deleteRowCount ?? rows.length };
      }
      if (statement === "ROLLBACK" && state.failRollback) {
        throw new Error("rollback failure");
      }
      return { rows: [], rowCount: null };
    },
    release() {
      released = true;
    },
  };
  return {
    client,
    statements,
    get released() {
      return released;
    },
  };
}

function user(role = "university_admin") {
  return { id: "user-1", role };
}

function googleAccount(id = "account-1", providerAccountId = "google-account-1234") {
  return { id, provider_account_id: providerAccountId };
}

function connectWith(state: MockState) {
  const mock = createMockClient(state);
  return {
    mock,
    connect: async () => mock.client,
  };
}

test("analyse les arguments et n'active apply qu'avec le drapeau explicite", () => {
  assert.deepEqual(parseUnlinkAdminGoogleArguments(["Admin@Example.com"]), {
    email: "admin@example.com",
    apply: false,
  });
  assert.deepEqual(parseUnlinkAdminGoogleArguments(["--apply", "Admin@Example.com"]), {
    email: "admin@example.com",
    apply: true,
  });
  assert.deepEqual(parseUnlinkAdminGoogleArguments(["Admin@Example.com", "--apply"]), {
    email: "admin@example.com",
    apply: true,
  });
  assert.equal(parseUnlinkAdminGoogleArguments([]), null);
  assert.equal(parseUnlinkAdminGoogleArguments(["not-an-email"]), null);
  assert.equal(parseUnlinkAdminGoogleArguments(["admin@example.com", "--apply", "--apply"]), null);
  assert.equal(parseUnlinkAdminGoogleArguments(["admin@example.com", "--other"]), null);
});

test("masque entièrement un identifiant court et ne conserve que quatre caractères sinon", () => {
  assert.equal(maskProviderAccountId("1234"), "****");
  assert.equal(maskProviderAccountId("google-account-1234"), "****1234");
});

test("dry-run utilise une transaction READ ONLY et ne lance aucun DELETE", async () => {
  const { mock, connect } = connectWith({
    userRows: [user()],
    accountRows: [googleAccount()],
  });
  const result = await runUnlinkAdminGoogleAccount({
    email: "admin@example.com",
    apply: false,
    connect,
  });

  assert.deepEqual(result, {
    status: "dry_run_ready",
    googleAccountCount: 1,
    providerAccountIdMasked: "****1234",
  });
  assert.equal(mock.statements[0].statement, "BEGIN READ ONLY");
  assert.equal(mock.statements.some(({ statement }) => statement.startsWith("DELETE")), false);
  assert.equal(mock.statements.at(-1)?.statement, "COMMIT");
  assert.equal(mock.released, true);
});

test("dry-run signale chaque refus sans effectuer de suppression", async () => {
  const cases: Array<{
    state: MockState;
    expected: string;
    googleAccountCount: number;
  }> = [
    { state: { userRows: [], accountRows: [] }, expected: "user_not_found", googleAccountCount: 0 },
    {
      state: { userRows: [user("student")], accountRows: [] },
      expected: "wrong_role",
      googleAccountCount: 0,
    },
    {
      state: { userRows: [user()], accountRows: [] },
      expected: "no_google_account",
      googleAccountCount: 0,
    },
    {
      state: { userRows: [user()], accountRows: [googleAccount(), googleAccount("account-2")] },
      expected: "multiple_google_accounts",
      googleAccountCount: 2,
    },
  ];

  for (const { state, expected, googleAccountCount } of cases) {
    const { mock, connect } = connectWith(state);
    const result = await runUnlinkAdminGoogleAccount({
      email: "admin@example.com",
      apply: false,
      connect,
    });
    assert.equal(result.status, expected);
    assert.equal(result.googleAccountCount, googleAccountCount);
    assert.equal(mock.statements.some(({ statement }) => statement.startsWith("DELETE")), false);
    assert.equal(mock.statements.at(-1)?.statement, "COMMIT");
    assert.equal(mock.released, true);
  }
});

test("user_not_unique refuse en dry-run et apply sans supprimer", async () => {
  for (const apply of [false, true]) {
    const { mock, connect } = connectWith({
      userRows: [user(), { id: "user-2", role: "university_admin" }],
      accountRows: [],
    });
    const result = await runUnlinkAdminGoogleAccount({
      email: "admin@example.com",
      apply,
      connect,
    });

    assert.equal(result.status, "user_not_unique");
    assert.equal(mock.statements.some(({ statement }) => statement.startsWith("DELETE")), false);
    assert.equal(mock.statements.at(-1)?.statement, apply ? "ROLLBACK" : "COMMIT");
    assert.equal(mock.released, true);
  }
});

test("apply verrouille utilisateur et comptes, puis supprime uniquement son compte Google", async () => {
  const { mock, connect } = connectWith({
    userRows: [user()],
    accountRows: [googleAccount()],
  });
  const result = await runUnlinkAdminGoogleAccount({
    email: "admin@example.com",
    apply: true,
    connect,
  });

  assert.deepEqual(result, {
    status: "deleted",
    googleAccountCount: 1,
    providerAccountIdMasked: "****1234",
  });
  assert.match(mock.statements[0].statement, /^BEGIN$/);
  assert.match(mock.statements[1].statement, /FROM users[\s\S]*FOR UPDATE$/);
  assert.match(mock.statements[2].statement, /provider = 'google'[\s\S]*FOR UPDATE$/);
  const deletion = mock.statements.find(({ statement }) => statement.startsWith("DELETE"));
  assert.ok(deletion);
  assert.match(deletion.statement, /WHERE id = \$1[\s\S]*user_id = \$2[\s\S]*provider = 'google'/);
  assert.deepEqual(deletion.values, ["account-1", "user-1"]);
  assert.equal(mock.statements.at(-1)?.statement, "COMMIT");
  assert.equal(mock.statements.some(({ statement }) => /UPDATE users|DELETE FROM users|sessions/i.test(statement)), false);
  assert.equal(mock.released, true);
});

test("apply annule les refus avant toute suppression", async () => {
  const cases: Array<{ state: MockState; expected: string }> = [
    { state: { userRows: [], accountRows: [] }, expected: "user_not_found" },
    { state: { userRows: [user("student")], accountRows: [] }, expected: "wrong_role" },
    { state: { userRows: [user()], accountRows: [] }, expected: "no_google_account" },
    {
      state: { userRows: [user()], accountRows: [googleAccount(), googleAccount("account-2")] },
      expected: "multiple_google_accounts",
    },
  ];

  for (const { state, expected } of cases) {
    const { mock, connect } = connectWith(state);
    const result = await runUnlinkAdminGoogleAccount({
      email: "admin@example.com",
      apply: true,
      connect,
    });
    assert.equal(result.status, expected);
    assert.equal(mock.statements.some(({ statement }) => statement.startsWith("DELETE")), false);
    assert.equal(mock.statements.at(-1)?.statement, "ROLLBACK");
    assert.equal(mock.released, true);
  }
});

test("apply annule si DELETE ne retourne pas exactement une ligne", async () => {
  const { mock, connect } = connectWith({
    userRows: [user()],
    accountRows: [googleAccount()],
    deleteRows: [],
    deleteRowCount: 0,
  });

  await assert.rejects(
    runUnlinkAdminGoogleAccount({
      email: "admin@example.com",
      apply: true,
      connect,
    }),
    { message: "DELETE_COUNT_MISMATCH" },
  );
  assert.equal(mock.statements.at(-1)?.statement, "ROLLBACK");
  assert.equal(mock.released, true);
});

test("erreur de requête annule la transaction et libère toujours le client", async () => {
  const { mock, connect } = connectWith({
    userRows: [user()],
    accountRows: [googleAccount()],
    failDelete: true,
  });

  await assert.rejects(
    runUnlinkAdminGoogleAccount({
      email: "admin@example.com",
      apply: true,
      connect,
    }),
    { message: "database failure" },
  );
  assert.equal(mock.statements.at(-1)?.statement, "ROLLBACK");
  assert.equal(mock.released, true);
});

test("une erreur de ROLLBACK est rapportée comme ROLLBACK_FAILED et libère le client", async () => {
  const { mock, connect } = connectWith({
    userRows: [user()],
    accountRows: [googleAccount()],
    failDelete: true,
    failRollback: true,
  });

  await assert.rejects(
    runUnlinkAdminGoogleAccount({
      email: "admin@example.com",
      apply: true,
      connect,
    }),
    { message: "ROLLBACK_FAILED" },
  );
  assert.equal(mock.statements.at(-1)?.statement, "ROLLBACK");
  assert.equal(mock.released, true);
});
