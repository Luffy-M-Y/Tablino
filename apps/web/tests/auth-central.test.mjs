import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTH_TRANSACTION_TTL_MS,
  createAuthTransaction,
  verifyAuthTransaction,
} from "../src/lib/auth-transaction.mjs";
import {
  AUTH_CENTRAL_ROUTE_HEADER,
  AUTH_TRANSACTION_COOKIE_NAME,
  createAuthCentralStartHandler,
} from "../src/lib/auth-central-start.mjs";
import {
  AUTH_CENTRAL_CALLBACK_URL,
  AUTH_CENTRAL_CALLBACK_URL_FIELD_NAME,
  AUTH_CENTRAL_SIGNIN_ACTION,
  AUTH_CENTRAL_SIGNIN_ERROR,
  AUTH_CENTRAL_SIGNIN_METHOD,
  AUTH_CENTRAL_CSRF_FIELD_NAME,
  getAuthCentralSigninPage,
} from "../src/lib/auth-central-signin.mjs";
import { createGoogleUniversityResolver } from "../src/lib/google-university-resolver.mjs";

const NOW = new Date("2026-11-10T09:00:00.000Z");
const SECRET = "test-nextauth-secret";
const UNIVERSITY_ID = "university-test";
const BASE_URL = "http://localhost:3000";
const AUTH_CENTRAL_HOST = "localhost:3000";
const GOOGLE_LOCATION = "https://accounts.google.com/o/oauth2/v2/auth?client_id=test";

function createTransaction(options = {}) {
  return createAuthTransaction({
    universityId: UNIVERSITY_ID,
    now: NOW,
    secret: SECRET,
    ...options,
  });
}

function createStartHandler({
  consumedUniversityId = UNIVERSITY_ID,
  getSecret = () => SECRET,
  secure = false,
  consumeOauthStartTicket = async () => consumedUniversityId,
} = {}) {
  return createAuthCentralStartHandler({
    consumeOauthStartTicket,
    getSecret,
    secure,
    now: () => new Date(NOW),
  });
}

function createStartHandlerWithFetch({ secure = false, fetchImpl } = {}) {
  return createAuthCentralStartHandler({
    consumeOauthStartTicket: async () => UNIVERSITY_ID,
    getSecret: () => SECRET,
    secure,
    baseUrl: BASE_URL,
    authCentralHost: AUTH_CENTRAL_HOST,
    now: () => new Date(NOW),
    fetchImpl,
  });
}

function makeSuccessFetch() {
  return async (url) => {
    if (url.endsWith("/api/auth/csrf")) {
      return new Response(JSON.stringify({ csrfToken: "csrf-token" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(null, {
      status: 303,
      headers: { Location: GOOGLE_LOCATION },
    });
  };
}

function createStartRequest({ includeHeader = true, ticket = "single-use-ticket" } = {}) {
  const form = new URLSearchParams();
  if (ticket !== null) form.set("ticket", ticket);
  const headers = { "Content-Type": "application/x-www-form-urlencoded" };
  if (includeHeader) headers[AUTH_CENTRAL_ROUTE_HEADER] = "1";
  return new Request("http://localhost:3000/auth-central/start", {
    method: "POST",
    headers,
    body: form,
  });
}

test("auth transaction verifies its signed university and fifteen-minute expiry", () => {
  const transaction = createTransaction();

  assert.equal(
    verifyAuthTransaction(transaction, { now: NOW, secret: SECRET }),
    UNIVERSITY_ID,
  );
  assert.equal(AUTH_TRANSACTION_TTL_MS, 15 * 60 * 1000);
});

test("auth transaction rejects a forged value", () => {
  const transaction = createTransaction();
  const forged = `${transaction.slice(0, -1)}${transaction.endsWith("A") ? "B" : "A"}`;

  assert.equal(verifyAuthTransaction(forged, { now: NOW, secret: SECRET }), null);
});

test("auth transaction rejects an expired value", () => {
  const transaction = createTransaction();

  assert.equal(
    verifyAuthTransaction(
      transaction,
      { now: new Date(NOW.getTime() + AUTH_TRANSACTION_TTL_MS), secret: SECRET },
    ),
    null,
  );
});

test("auth transaction rejects a wrong or empty secret", () => {
  const transaction = createTransaction();

  assert.equal(verifyAuthTransaction(transaction, { now: NOW, secret: "wrong-secret" }), null);
  assert.equal(verifyAuthTransaction(transaction, { now: NOW, secret: "" }), null);
});

test("auth transaction rejects malformed values", () => {
  for (const malformed of ["", "v2.payload.signature", "v1.?.signature", "v1.payload.signature.extra"]) {
    assert.equal(verifyAuthTransaction(malformed, { now: NOW, secret: SECRET }), null);
  }
});

test("auth central start returns 404 unless the proxy marks the central route", async () => {
  const response = await createStartHandler()(createStartRequest({ includeHeader: false }));

  assert.equal(response.status, 404);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
});

test("auth central start refuses a missing or invalid ticket generically", async () => {
  let consumeCount = 0;
  const handler = createStartHandler({
    consumedUniversityId: null,
    consumeOauthStartTicket: async () => {
      consumeCount++;
      return null;
    },
  });

  const missingResponse = await handler(createStartRequest({ ticket: null }));
  const invalidResponse = await handler(createStartRequest());

  assert.equal(missingResponse.status, 400);
  assert.equal(invalidResponse.status, 400);
  assert.equal(await missingResponse.text(), await invalidResponse.text());
  assert.equal(consumeCount, 1);
  assert.equal(invalidResponse.headers.get("Cache-Control"), "no-store");
});

test("auth central start reports missing secret without consuming a ticket", async () => {
  let consumeCount = 0;
  const response = await createStartHandler({
    getSecret: () => undefined,
    consumeOauthStartTicket: async () => {
      consumeCount++;
      return UNIVERSITY_ID;
    },
  })(createStartRequest());

  assert.equal(response.status, 500);
  assert.equal(consumeCount, 0);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
});

test("auth central start sets a secure transaction cookie and redirects without the ticket", async () => {
  const ticket = "sensitive-single-use-ticket";
  const response = await createStartHandlerWithFetch({ secure: true, fetchImpl: makeSuccessFetch() })(
    createStartRequest({ ticket }),
  );
  const setCookies = response.headers.getSetCookie();
  const cookie = setCookies.find((c) => c.startsWith(AUTH_TRANSACTION_COOKIE_NAME + "=")) ?? null;

  assert.equal(response.status, 303);
  assert.equal(response.headers.get("Location"), GOOGLE_LOCATION);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(response.headers.get("Location").includes(ticket), false);
  assert.match(cookie, new RegExp(`^${AUTH_TRANSACTION_COOKIE_NAME}=v1\\.`));
  assert.match(cookie, /;\s*Max-Age=900/);
  assert.match(cookie, /;\s*Path=\//);
  assert.match(cookie, /;\s*HttpOnly/);
  assert.match(cookie, /;\s*SameSite=Lax/);
  assert.match(cookie, /;\s*Secure/);
  assert.doesNotMatch(cookie, /;\s*Domain=/i);
  assert.equal(cookie.includes(ticket), false);
  assert.equal(
    verifyAuthTransaction(
      cookie.split(";")[0].slice(AUTH_TRANSACTION_COOKIE_NAME.length + 1),
      { now: NOW, secret: SECRET },
    ),
    UNIVERSITY_ID,
  );
});

test("auth central start omits Secure when the configured cookie is not secure", async () => {
  const response = await createStartHandlerWithFetch({ secure: false, fetchImpl: makeSuccessFetch() })(
    createStartRequest(),
  );
  const setCookies = response.headers.getSetCookie();
  const cookie = setCookies.find((c) => c.startsWith(AUTH_TRANSACTION_COOKIE_NAME + "=")) ?? null;

  assert.ok(cookie !== null, "cookie de transaction absent");
  assert.doesNotMatch(cookie, /;\s*Secure(?:;|$)/);
});

test("auth central start without baseUrl or authCentralHost redirects to error page without Set-Cookie", async () => {
  // Sans baseUrl/authCentralHost, errorResponse() : 303 vers /auth-central/error, aucun cookie.
  const response = await createStartHandler({ secure: true })(
    createStartRequest(),
  );

  assert.equal(response.status, 303);
  assert.equal(response.headers.get("Location"), "/auth-central/error");
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(response.headers.getSetCookie().length, 0);
});

test("auth central signin page reports an expired session without a valid cookie", () => {
  const page = getAuthCentralSigninPage(undefined, { now: NOW, secret: SECRET });

  assert.deepEqual(page, { kind: "expired", message: AUTH_CENTRAL_SIGNIN_ERROR });
});

test("auth central signin page provides the real Google form configuration with a valid cookie", () => {
  const page = getAuthCentralSigninPage(createTransaction(), { now: NOW, secret: SECRET });

  assert.deepEqual(page, {
    kind: "signin",
    action: AUTH_CENTRAL_SIGNIN_ACTION,
    method: AUTH_CENTRAL_SIGNIN_METHOD,
    callbackUrl: AUTH_CENTRAL_CALLBACK_URL,
    csrfFieldName: AUTH_CENTRAL_CSRF_FIELD_NAME,
    callbackUrlFieldName: AUTH_CENTRAL_CALLBACK_URL_FIELD_NAME,
  });
});

test("Google resolver reads the signed transaction on the configured central host", async () => {
  let tenantResolverCalls = 0;
  const resolver = createGoogleUniversityResolver({
    getHost: async () => "LOCALHOST:3000",
    getAuthCentralHost: () => "localhost:3000",
    getCookie: async () => createTransaction(),
    getSecret: () => SECRET,
    getCurrentUniversityId: async () => {
      tenantResolverCalls++;
      return "tenant-from-host";
    },
    now: () => NOW,
  });

  assert.equal(await resolver(), UNIVERSITY_ID);
  assert.equal(tenantResolverCalls, 0);
});

test("Google resolver rejects a missing or invalid central transaction", async () => {
  for (const cookie of [undefined, "invalid-transaction"]) {
    const resolver = createGoogleUniversityResolver({
      getHost: async () => "localhost:3000",
      getAuthCentralHost: () => "localhost:3000",
      getCookie: async () => cookie,
      getSecret: () => SECRET,
      getCurrentUniversityId: async () => "tenant-from-host",
      now: () => NOW,
    });
    assert.equal(await resolver(), null);
  }
});

test("Google resolver preserves host tenant resolution away from the central host", async () => {
  let cookieCalls = 0;
  const resolver = createGoogleUniversityResolver({
    getHost: async () => "university.localhost:3000",
    getAuthCentralHost: () => "localhost:3000",
    getCookie: async () => {
      cookieCalls++;
      return createTransaction();
    },
    getSecret: () => SECRET,
    getCurrentUniversityId: async () => "tenant-from-host",
    now: () => NOW,
  });

  assert.equal(await resolver(), "tenant-from-host");
  assert.equal(cookieCalls, 0);
});
