import assert from "node:assert/strict";
import test from "node:test";
import {
  getAuthAdminTransferCookieExpirations,
  runAuthAdminTransfer,
} from "../src/lib/auth-admin-transfer.mjs";
import {
  AUTH_ADMIN_TRANSACTION_COOKIE_NAME,
  createAuthAdminTransaction,
} from "../src/lib/auth-admin-transaction.mjs";

const NOW = new Date("2026-11-14T07:00:00.000Z");
const SECRET = "test-nextauth-secret";
const CENTRAL_HOST = "auth-admin.localhost:3001";
const UNIVERSITY_ID = "university-test";
const USER_ID = "admin-test";
const SESSION_TOKEN = "central-nextauth-session-token";
const SESSION_COOKIE_CONFIG = {
  name: "__Secure-tablino-admin.session-token",
  options: {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: true,
  },
};

function makeOptions(overrides = {}) {
  const calls = { created: [], deleted: [] };
  const options = {
    host: CENTRAL_HOST,
    centralHost: CENTRAL_HOST,
    session: {
      user: {
        id: USER_ID,
        role: "university_admin",
        universityId: UNIVERSITY_ID,
      },
    },
    sessionToken: SESSION_TOKEN,
    transactionCookie: createAuthAdminTransaction({
      universityId: UNIVERSITY_ID,
      now: NOW,
      secret: SECRET,
    }),
    secret: SECRET,
    now: NOW,
    adminRootDomain: "admin.tablino.com",
    secure: true,
    lookupUniversitySlug: async (universityId) => {
      assert.equal(universityId, UNIVERSITY_ID);
      return "iscom";
    },
    createTransferCode: async (input) => {
      calls.created.push(input);
      return "transfer-code";
    },
    deleteSession: async (token) => {
      calls.deleted.push(token);
      return { deleted: true };
    },
    ...overrides,
  };
  return { options, calls };
}

test("central transfer verifies the admin transaction, deletes its NextAuth session, and builds the university return URL", async () => {
  const { options, calls } = makeOptions();
  const result = await runAuthAdminTransfer(options);

  assert.deepEqual(calls.created, [{ universityId: UNIVERSITY_ID, userId: USER_ID }]);
  assert.deepEqual(calls.deleted, [SESSION_TOKEN]);
  assert.deepEqual(result, {
    ok: true,
    redirectUrl:
      "https://iscom-admin.admin.tablino.com/auth-admin/return?code=transfer-code",
  });
});

test("central transfer requires the central host, university-admin role, matching transaction, and session cookie", async () => {
  const invalidCases = [
    { host: "iscom-admin.admin.tablino.com" },
    { session: { user: { id: USER_ID, role: "super_admin", universityId: null } } },
    {
      session: {
        user: { id: USER_ID, role: "university_admin", universityId: "other-university" },
      },
    },
    { sessionToken: undefined },
    { transactionCookie: "invalid" },
  ];

  for (const invalidCase of invalidCases) {
    const { options, calls } = makeOptions(invalidCase);
    assert.deepEqual(await runAuthAdminTransfer(options), { ok: false });
    assert.deepEqual(calls.created, []);
    assert.deepEqual(calls.deleted, []);
  }
});

test("invalid destination and code creation failures do not revoke the central session", async () => {
  for (const overrides of [
    { adminRootDomain: "invalid/path" },
    { lookupUniversitySlug: async () => null },
    { createTransferCode: async () => { throw new Error("database detail"); } },
  ]) {
    const { options, calls } = makeOptions(overrides);
    assert.deepEqual(await runAuthAdminTransfer(options), { ok: false });
    assert.deepEqual(calls.deleted, []);
  }
});

test("a failed central-session deletion prevents the transfer redirect", async () => {
  const { options } = makeOptions({ deleteSession: async () => ({ deleted: false }) });
  assert.deepEqual(await runAuthAdminTransfer(options), { ok: false });
});

test("successful transfer expires the exact admin session and transaction cookies", () => {
  const expirations = getAuthAdminTransferCookieExpirations(SESSION_COOKIE_CONFIG, true);

  assert.deepEqual(expirations.map(({ name }) => name), [
    SESSION_COOKIE_CONFIG.name,
    AUTH_ADMIN_TRANSACTION_COOKIE_NAME,
  ]);
  for (const cookie of expirations) {
    assert.equal(cookie.options.path, "/");
    assert.equal(cookie.options.httpOnly, true);
    assert.equal(cookie.options.sameSite, "lax");
    assert.equal(cookie.options.secure, true);
    assert.equal(cookie.options.maxAge, 0);
    assert.equal(cookie.options.expires.getTime(), 0);
  }
});

test("central transfer refuses cookie with cross-flow or incompatible session role", async () => {
  // 1. Cookie super_login mais session university_admin
  const superTxCookie = createAuthAdminTransaction({
    flow: "super_login",
    transactionId: "tx-super-123",
    now: NOW,
    secret: SECRET,
  });
  const res1 = await runAuthAdminTransfer(makeOptions({
    transactionCookie: superTxCookie,
    session: { user: { id: USER_ID, role: "university_admin", universityId: UNIVERSITY_ID } },
  }).options);
  assert.deepEqual(res1, { ok: false });

  // 2. Cookie university mais session super_admin_editor
  const univTxCookie = createAuthAdminTransaction({
    flow: "university",
    universityId: UNIVERSITY_ID,
    now: NOW,
    secret: SECRET,
  });
  const res2 = await runAuthAdminTransfer(makeOptions({
    transactionCookie: univTxCookie,
    session: { user: { id: USER_ID, role: "super_admin_editor", universityId: null } },
  }).options);
  assert.deepEqual(res2, { ok: false });

  // 3. Cookie invitation mais session avec universityId non nul
  const invTxCookie = createAuthAdminTransaction({
    flow: "invitation",
    invitationId: "inv-123",
    transactionId: "tx-inv-123",
    now: NOW,
    secret: SECRET,
  });
  const res3 = await runAuthAdminTransfer(makeOptions({
    transactionCookie: invTxCookie,
    session: { user: { id: USER_ID, role: "super_admin_editor", universityId: "univ-1" } },
  }).options);
  assert.deepEqual(res3, { ok: false });
});

test("central transfer refuses super_admin role unconditionally", async () => {
  for (const flow of ["university", "super_login", "invitation"]) {
    let txCookie;
    if (flow === "university") {
      txCookie = createAuthAdminTransaction({ flow: "university", universityId: UNIVERSITY_ID, now: NOW, secret: SECRET });
    } else if (flow === "super_login") {
      txCookie = createAuthAdminTransaction({ flow: "super_login", transactionId: "tx-1", now: NOW, secret: SECRET });
    } else {
      txCookie = createAuthAdminTransaction({ flow: "invitation", invitationId: "i-1", transactionId: "tx-1", now: NOW, secret: SECRET });
    }
    const res = await runAuthAdminTransfer(makeOptions({
      transactionCookie: txCookie,
      session: { user: { id: USER_ID, role: "super_admin", universityId: null } },
    }).options);
    assert.deepEqual(res, { ok: false });
  }
});

test("central transfer handles super_login flow nominally", async () => {
  const calls = { superCreated: [], deleted: [] };
  const txCookie = createAuthAdminTransaction({
    flow: "super_login",
    transactionId: "tx-super-abc",
    now: NOW,
    secret: SECRET,
  });

  const result = await runAuthAdminTransfer({
    host: CENTRAL_HOST,
    centralHost: CENTRAL_HOST,
    session: {
      user: {
        id: "super-user-1",
        role: "super_admin_editor",
        universityId: null,
      },
    },
    sessionToken: SESSION_TOKEN,
    transactionCookie: txCookie,
    secret: SECRET,
    now: NOW,
    adminRootDomain: "admin.tablino.com",
    secure: true,
    createSuperLoginTransferCode: async (input) => {
      calls.superCreated.push(input);
      return "super-transfer-code-123";
    },
    deleteSession: async (token) => {
      calls.deleted.push(token);
      return { deleted: true };
    },
  });

  assert.deepEqual(calls.superCreated, [{ transactionId: "tx-super-abc", userId: "super-user-1" }]);
  assert.deepEqual(calls.deleted, [SESSION_TOKEN]);
  assert.deepEqual(result, {
    ok: true,
    redirectUrl: "https://sup-admin.admin.tablino.com/auth-admin/return?code=super-transfer-code-123&flow=super_login",
  });
});

test("central transfer handles invitation flow nominally", async () => {
  const calls = { invCreated: [], deleted: [] };
  const txCookie = createAuthAdminTransaction({
    flow: "invitation",
    invitationId: "invitation-abc",
    transactionId: "tx-inv-abc",
    now: NOW,
    secret: SECRET,
  });

  const result = await runAuthAdminTransfer({
    host: CENTRAL_HOST,
    centralHost: CENTRAL_HOST,
    session: {
      user: {
        id: "invited-user-1",
        role: "super_admin_lector",
        universityId: null,
      },
    },
    sessionToken: SESSION_TOKEN,
    transactionCookie: txCookie,
    secret: SECRET,
    now: NOW,
    adminRootDomain: "admin.tablino.com",
    secure: true,
    createInvitationTransferCode: async (input) => {
      calls.invCreated.push(input);
      return "inv-transfer-code-456";
    },
    deleteSession: async (token) => {
      calls.deleted.push(token);
      return { deleted: true };
    },
  });

  assert.deepEqual(calls.invCreated, [{
    invitationId: "invitation-abc",
    transactionId: "tx-inv-abc",
    userId: "invited-user-1",
  }]);
  assert.deepEqual(calls.deleted, [SESSION_TOKEN]);
  assert.deepEqual(result, {
    ok: true,
    redirectUrl: "https://sup-admin.admin.tablino.com/auth-admin/return?code=inv-transfer-code-456&flow=invitation",
  });
});
