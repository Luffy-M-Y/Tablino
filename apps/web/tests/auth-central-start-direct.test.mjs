import assert from "node:assert/strict";
import test from "node:test";
import {
  createAuthCentralStartHandler,
  AUTH_CENTRAL_ROUTE_HEADER,
  AUTH_TRANSACTION_COOKIE_NAME,
} from "../src/lib/auth-central-start.mjs";

const BASE_URL = "http://localhost:3000";
const AUTH_CENTRAL_HOST = "localhost:3000";
const SECRET = "test-secret-with-enough-length";
const CSRF_TOKEN = "csrf-token-value";
const GOOGLE_LOCATION = "https://accounts.google.com/o/oauth2/v2/auth?client_id=test";

function makeRequest(ticket = "valid-ticket") {
  const form = new URLSearchParams();
  form.set("ticket", ticket);
  return new Request("http://localhost:3000/auth-central/start", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      [AUTH_CENTRAL_ROUTE_HEADER]: "1",
    },
    body: form.toString(),
  });
}

function makeCsrfResponse(opts = {}) {
  const { status = 200, csrfToken = CSRF_TOKEN, cookies = ["__Host-next-auth.csrf-token=abc; Path=/; HttpOnly"] } = opts;
  const headers = new Headers({ "Content-Type": "application/json" });
  for (const c of cookies) headers.append("Set-Cookie", c);
  return new Response(JSON.stringify({ csrfToken: csrfToken ?? undefined }), { status, headers });
}

function makeSigninResponse(opts = {}) {
  const { status = 303, location = GOOGLE_LOCATION, cookies = ["next-auth.state=xyz; Path=/; HttpOnly"] } = opts;
  const headers = new Headers();
  if (location) headers.set("Location", location);
  for (const c of cookies) headers.append("Set-Cookie", c);
  return new Response(null, { status, headers });
}

function createHandler(fetchImpl) {
  return createAuthCentralStartHandler({
    consumeOauthStartTicket: async () => "university-1",
    getSecret: () => SECRET,
    secure: false,
    baseUrl: BASE_URL,
    authCentralHost: AUTH_CENTRAL_HOST,
    fetchImpl,
  });
}

// ─── Succès : 303 vers Google, tous les Set-Cookie présents ──────────────────

test("direct Google redirect succeeds with 303 and all Set-Cookie headers", async () => {
  const csrfCookie = "__Host-next-auth.csrf-token=abc; Path=/; HttpOnly";
  const signinCookie = "next-auth.state=xyz; Path=/; HttpOnly";
  let callCount = 0;
  const fetchImpl = async (url) => {
    callCount++;
    if (url.endsWith("/api/auth/csrf")) return makeCsrfResponse({ cookies: [csrfCookie] });
    return makeSigninResponse({ cookies: [signinCookie] });
  };

  const handler = createHandler(fetchImpl);
  const res = await handler(makeRequest());

  assert.equal(res.status, 303);
  assert.equal(res.headers.get("Location"), GOOGLE_LOCATION);
  const setCookies = res.headers.getSetCookie();
  assert.ok(setCookies.some((c) => c.startsWith(AUTH_TRANSACTION_COOKIE_NAME + "=")), "tx cookie absent");
  assert.ok(setCookies.some((c) => c.includes("csrf-token")), "csrf cookie absent");
  assert.ok(setCookies.some((c) => c.includes("next-auth.state")), "state cookie absent");
  assert.equal(setCookies.length, 3, "attendu 3 cookies : tx, csrf, state");
  assert.equal(callCount, 2);
});

// ─── Assertion : Cookie du POST signin contient txCookie ET CSRF ─────────────

test("POST signin receives Cookie header with tx token and CSRF cookie", async () => {
  const csrfCookie = "__Host-next-auth.csrf-token=csrf-abc; Path=/; HttpOnly";
  let signinCookieHeader = null;
  const fetchImpl = async (url, opts) => {
    if (url.endsWith("/api/auth/csrf")) return makeCsrfResponse({ cookies: [csrfCookie] });
    signinCookieHeader = opts?.headers?.Cookie ?? null;
    return makeSigninResponse();
  };

  const handler = createHandler(fetchImpl);
  await handler(makeRequest());

  assert.ok(signinCookieHeader !== null, "Cookie header absent du POST signin");
  assert.ok(
    signinCookieHeader.includes(AUTH_TRANSACTION_COOKIE_NAME + "="),
    `tablino-oauth-tx absent du Cookie signin : ${signinCookieHeader}`,
  );
  assert.ok(
    signinCookieHeader.includes("csrf-token=csrf-abc"),
    `cookie CSRF absent du Cookie signin : ${signinCookieHeader}`,
  );
});

// ─── CSRF en échec : repli vers /auth-central/signin ─────────────────────────

test("falls back to signin page when CSRF request fails", async () => {
  const fetchImpl = async () => makeCsrfResponse({ status: 500 });
  const handler = createHandler(fetchImpl);
  const res = await handler(makeRequest());

  assert.equal(res.status, 303);
  assert.equal(res.headers.get("Location"), "/auth-central/signin");
  const setCookies = res.headers.getSetCookie();
  assert.ok(setCookies.some((c) => c.startsWith(AUTH_TRANSACTION_COOKIE_NAME + "=")));
  assert.equal(setCookies.length, 1);
});

// ─── Signin répond 200 : repli ────────────────────────────────────────────────

test("falls back when signin responds with 200 instead of 302/303", async () => {
  const fetchImpl = async (url) => {
    if (url.endsWith("/api/auth/csrf")) return makeCsrfResponse();
    return makeSigninResponse({ status: 200, location: null });
  };
  const handler = createHandler(fetchImpl);
  const res = await handler(makeRequest());

  assert.equal(res.status, 303);
  assert.equal(res.headers.get("Location"), "/auth-central/signin");
});

// ─── Location hors accounts.google.com : repli ───────────────────────────────

test("falls back when Location is not accounts.google.com", async () => {
  const fetchImpl = async (url) => {
    if (url.endsWith("/api/auth/csrf")) return makeCsrfResponse();
    return makeSigninResponse({ location: "https://evil.example.com/redirect" });
  };
  const handler = createHandler(fetchImpl);
  const res = await handler(makeRequest());

  assert.equal(res.status, 303);
  assert.equal(res.headers.get("Location"), "/auth-central/signin");
});

// ─── baseUrl ≠ authCentralHost : repli, aucun fetch ─────────────────────────

test("falls back without calling fetch when baseUrl host differs from authCentralHost", async () => {
  let fetchCalled = false;
  const fetchImpl = async () => { fetchCalled = true; return makeCsrfResponse(); };
  const handler = createAuthCentralStartHandler({
    consumeOauthStartTicket: async () => "university-1",
    getSecret: () => SECRET,
    secure: false,
    baseUrl: "http://localhost:3000",
    authCentralHost: "auth.tablino.com",
    fetchImpl,
  });
  const res = await handler(makeRequest());

  assert.equal(res.status, 303);
  assert.equal(res.headers.get("Location"), "/auth-central/signin");
  assert.equal(fetchCalled, false);
});

// ─── Erreur réseau : repli ────────────────────────────────────────────────────

test("falls back on network error", async () => {
  const fetchImpl = async () => { throw new Error("network error"); };
  const handler = createHandler(fetchImpl);
  const res = await handler(makeRequest());

  assert.equal(res.status, 303);
  assert.equal(res.headers.get("Location"), "/auth-central/signin");
});

// ─── Délai dépassé via signal d'abandon : repli ───────────────────────────────
// Note : le vrai délai de 5 s n'est pas attendu. On simule l'abandon via
// un fetchImpl qui détecte signal.aborted ou lève DOMException("AbortError").

test("falls back when fetch aborts via signal", async () => {
  const fetchImpl = async (url, opts) => {
    if (opts?.signal) {
      return new Promise((_, reject) => {
        if (opts.signal.aborted) {
          reject(new DOMException("Aborted", "AbortError"));
          return;
        }
        opts.signal.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      });
    }
    throw new Error("no signal");
  };

  const handler = createAuthCentralStartHandler({
    consumeOauthStartTicket: async () => "university-1",
    getSecret: () => SECRET,
    secure: false,
    baseUrl: BASE_URL,
    authCentralHost: AUTH_CENTRAL_HOST,
    // Timeout à 1 ms pour déclencher l'abort sans attendre 5 s.
    fetchImpl,
    fetchTimeoutMs: 1,
  });
  const res = await handler(makeRequest());

  assert.equal(res.status, 303);
  assert.equal(res.headers.get("Location"), "/auth-central/signin");
});

// ─── Aucun secret dans le corps de réponse ───────────────────────────────────

test("response body does not contain secret or csrfToken", async () => {
  const fetchImpl = async (url) => {
    if (url.endsWith("/api/auth/csrf")) return makeCsrfResponse();
    return makeSigninResponse();
  };
  const handler = createHandler(fetchImpl);
  const res = await handler(makeRequest());

  const body = await res.text();
  assert.equal(body.includes(SECRET), false);
  assert.equal(body.includes(CSRF_TOKEN), false);
});
