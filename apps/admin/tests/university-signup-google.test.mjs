import assert from "node:assert/strict";
import test from "node:test";
import { createAdminGoogleUniversityResolver } from "../src/lib/admin-google-resolver.mjs";
import { buildAdminLoginUrl, buildUniversitySignupUrl } from "../src/lib/admin-return-url.mjs";
import { runStartUniversityGoogleSignup } from "../src/lib/auth-admin-google-start.mjs";
import { getAuthAdminSigninPage } from "../src/lib/auth-admin-signin.mjs";
import { createAuthAdminStartHandler } from "../src/lib/auth-admin-start.mjs";
import {
  AUTH_ADMIN_TRANSACTION_COOKIE_NAME,
  createAuthAdminTransaction,
  parseAuthAdminTransaction,
  verifyAuthAdminTransaction,
} from "../src/lib/auth-admin-transaction.mjs";
import {
  createUniversitySignupStartTicket,
  UNIVERSITY_SIGNUP_START_TICKET_TTL_MS,
  verifyUniversitySignupStartTicket,
} from "../src/lib/university-signup-start-ticket.mjs";

const CENTRAL_HOST = "auth-admin.localhost:3001";
const SECRET = "test-nextauth-secret";
const NOW = new Date("2026-11-27T10:00:00.000Z");

function startRequest(params) {
  return new Request(`http://${CENTRAL_HOST}/auth-admin/start`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", host: CENTRAL_HOST },
    body: new URLSearchParams(params),
  });
}

function createStartHandler(options = {}) {
  return createAuthAdminStartHandler({
    consumeOauthStartTicket: async () => null,
    verifyUniversitySignupStartTicket,
    getSecret: () => SECRET,
    secure: false,
    baseUrl: undefined,
    authAdminCentralHost: CENTRAL_HOST,
    now: () => NOW,
    ...options,
  });
}

function readTransactionCookie(response) {
  const cookie = response.headers.get("Set-Cookie") ?? "";
  return cookie.split(";")[0]?.slice(`${AUTH_ADMIN_TRANSACTION_COOKIE_NAME}=`.length);
}

test("signup start ticket is valid for 5 minutes only", () => {
  const ticket = createUniversitySignupStartTicket({ now: NOW, secret: SECRET });
  assert.equal(UNIVERSITY_SIGNUP_START_TICKET_TTL_MS, 5 * 60 * 1000);
  assert.equal(verifyUniversitySignupStartTicket(ticket, { now: NOW, secret: SECRET }), true);
  assert.equal(verifyUniversitySignupStartTicket(ticket, {
    now: new Date(NOW.getTime() + UNIVERSITY_SIGNUP_START_TICKET_TTL_MS - 1),
    secret: SECRET,
  }), true);
  assert.equal(verifyUniversitySignupStartTicket(ticket, {
    now: new Date(NOW.getTime() + UNIVERSITY_SIGNUP_START_TICKET_TTL_MS),
    secret: SECRET,
  }), false);
});

test("signup start ticket rejects another secret, tampering and malformed values", () => {
  const ticket = createUniversitySignupStartTicket({ now: NOW, secret: SECRET });
  const [version, payload, signature] = ticket.split(".");
  const forgedPayload = Buffer.from(JSON.stringify({
    p: "university-signup-start",
    n: "AAAAAAAAAAAAAAAAAAAAAA",
    x: NOW.getTime() + 24 * 60 * 60 * 1000,
  })).toString("base64url");
  const flipped = (signature[0] === "A" ? "B" : "A") + signature.slice(1);

  for (const value of [
    `${version}.${forgedPayload}.${signature}`,
    `${version}.${payload}.${flipped}`,
    `v2.${payload}.${signature}`,
    `${payload}.${signature}`,
    "",
    "x".repeat(600),
    null,
    42,
  ]) {
    assert.equal(verifyUniversitySignupStartTicket(value, { now: NOW, secret: SECRET }), false);
  }
  assert.equal(verifyUniversitySignupStartTicket(ticket, { now: NOW, secret: "another-secret" }), false);
  assert.equal(verifyUniversitySignupStartTicket(ticket, { now: NOW, secret: undefined }), false);
  assert.throws(() => createUniversitySignupStartTicket({ now: NOW, secret: undefined }), TypeError);
});

test("signup start tickets are unique", () => {
  const first = createUniversitySignupStartTicket({ now: NOW, secret: SECRET });
  const second = createUniversitySignupStartTicket({ now: NOW, secret: SECRET });
  assert.notEqual(first, second);
});

test("university_signup transaction round-trips without identifiers", () => {
  const value = createAuthAdminTransaction({ flow: "university_signup", now: NOW, secret: SECRET });
  assert.deepEqual(parseAuthAdminTransaction(value, { now: NOW, secret: SECRET }), { flow: "university_signup" });
  assert.equal(verifyAuthAdminTransaction(value, { now: NOW, secret: SECRET }), true);
  assert.equal(verifyAuthAdminTransaction(value, { now: NOW, secret: SECRET, expectedFlow: "super_login" }), null);
  assert.equal(
    parseAuthAdminTransaction(value, { now: new Date(NOW.getTime() + 15 * 60 * 1000), secret: SECRET }),
    null,
  );
  assert.equal(getAuthAdminSigninPage(value, { now: NOW, secret: SECRET }).kind, "signin");
});

test("admin start accepts university_signup only with a valid signed ticket", async () => {
  const ticket = createUniversitySignupStartTicket({ now: NOW, secret: SECRET });
  const response = await createStartHandler()(startRequest({ kind: "university_signup", ticket }));
  assert.equal(response.status, 303);
  assert.deepEqual(
    parseAuthAdminTransaction(readTransactionCookie(response), { now: NOW, secret: SECRET }),
    { flow: "university_signup" },
  );

  const expired = createUniversitySignupStartTicket({
    now: new Date(NOW.getTime() - UNIVERSITY_SIGNUP_START_TICKET_TTL_MS),
    secret: SECRET,
  });
  const otherSecret = createUniversitySignupStartTicket({ now: NOW, secret: "another-secret" });
  for (const bad of [expired, otherSecret, "bad-ticket"]) {
    const refused = await createStartHandler()(startRequest({ kind: "university_signup", ticket: bad }));
    assert.equal(refused.status, 400);
    assert.equal(refused.headers.get("Set-Cookie"), null);
  }
});

test("admin start refuses university_signup without a ticket verifier", async () => {
  const ticket = createUniversitySignupStartTicket({ now: NOW, secret: SECRET });
  const response = await createStartHandler({ verifyUniversitySignupStartTicket: undefined })(
    startRequest({ kind: "university_signup", ticket }),
  );
  assert.equal(response.status, 500);
});

test("admin Google resolver returns the university_signup flow on the central host only", async () => {
  const cookie = createAuthAdminTransaction({ flow: "university_signup", now: NOW, secret: SECRET });
  const resolverFor = (host) => createAdminGoogleUniversityResolver({
    getHost: async () => host,
    getAuthAdminCentralHost: () => CENTRAL_HOST,
    getCookie: async () => cookie,
    getSecret: () => SECRET,
    now: () => NOW,
  });
  assert.deepEqual(await resolverFor(CENTRAL_HOST)(), { flow: "university_signup" });
  assert.equal(await resolverFor("sup-admin.localhost:3001")(), null);
});

test("university signup URL points to /university-signup on the signup host", () => {
  assert.equal(
    buildUniversitySignupUrl({ adminRootDomain: "localhost:3001", secure: false, token: "a.b" }),
    "http://inscription-admin.localhost:3001/university-signup?token=a.b",
  );
  assert.equal(
    buildUniversitySignupUrl({ adminRootDomain: "example.test", secure: true, token: "a+b" }),
    "https://inscription-admin.example.test/university-signup?token=a%2Bb",
  );
  assert.equal(
    buildUniversitySignupUrl({ adminRootDomain: "localhost:3001", secure: false, token: "" }),
    null,
  );
  assert.equal(
    buildUniversitySignupUrl({ adminRootDomain: "bad/domain", secure: false, token: "a" }),
    null,
  );
});

test("login URL carries the pending signup notice only on request", () => {
  assert.equal(
    buildAdminLoginUrl({ slug: "u-a1b2c3d4e5f6", adminRootDomain: "localhost:3001", secure: false, signupPending: true }),
    "http://u-a1b2c3d4e5f6-admin.localhost:3001/login?inscription=en-attente",
  );
  assert.equal(
    buildAdminLoginUrl({ slug: "u-a1b2c3d4e5f6", adminRootDomain: "localhost:3001", secure: false }),
    "http://u-a1b2c3d4e5f6-admin.localhost:3001/login",
  );
  assert.equal(
    buildAdminLoginUrl({ slug: "bad slug", adminRootDomain: "localhost:3001", secure: false, signupPending: true }),
    null,
  );
});

test("university Google signup starts only on the signup host", async () => {
  const options = {
    createTicket: () => "ticket-value",
    getCentralHost: () => CENTRAL_HOST,
    secure: false,
  };
  const signupHost = async () => ({ kind: "signup" });
  assert.deepEqual(
    await runStartUniversityGoogleSignup({ ...options, getHostContext: signupHost }),
    {
      ok: true,
      action: `http://${CENTRAL_HOST}/auth-admin/start`,
      ticket: "ticket-value",
      kind: "university_signup",
    },
  );

  const failingTicket = () => {
    throw new Error("ticket");
  };
  const failingHost = async () => {
    throw new Error("host");
  };
  for (const refused of [
    { ...options, getHostContext: async () => ({ kind: "university", universityId: "u1" }) },
    { ...options, getHostContext: async () => ({ kind: "super" }) },
    { ...options, getHostContext: async () => null },
    { ...options, getHostContext: failingHost },
    { ...options, getHostContext: signupHost, getCentralHost: () => undefined },
    { ...options, getHostContext: signupHost, createTicket: failingTicket },
    { ...options, getHostContext: signupHost, createTicket: () => "" },
  ]) {
    const result = await runStartUniversityGoogleSignup(refused);
    assert.equal(result.ok, false);
  }
});
