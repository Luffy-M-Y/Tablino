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
const ERROR_PATH = "/auth-central/error";

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

// ─── Réponses de protocole : statut, corps, Content-Type ─────────────────────

test("404 response has correct status, body and Content-Type", async () => {
  const handler = createAuthCentralStartHandler({
    consumeOauthStartTicket: async () => "university-1",
    getSecret: () => SECRET,
    secure: false,
  });
  const req = new Request("http://localhost:3000/auth-central/start", { method: "POST" });
  const res = await handler(req);

  assert.equal(res.status, 404);
  const body = await res.text();
  assert.ok(body.length > 0, "corps 404 vide");
  assert.ok(res.headers.get("Content-Type")?.startsWith("text/plain"), "Content-Type 404 manquant");
});

test("500 response (missing secret) has correct status, body and Content-Type", async () => {
  const handler = createAuthCentralStartHandler({
    consumeOauthStartTicket: async () => "university-1",
    getSecret: () => undefined,
    secure: false,
    baseUrl: BASE_URL,
    authCentralHost: AUTH_CENTRAL_HOST,
  });
  const req = new Request("http://localhost:3000/auth-central/start", {
    method: "POST",
    headers: { [AUTH_CENTRAL_ROUTE_HEADER]: "1" },
    body: new URLSearchParams({ ticket: "t" }).toString(),
  });
  const res = await handler(req);

  assert.equal(res.status, 500);
  const body = await res.text();
  assert.ok(body.length > 0, "corps 500 vide");
  assert.ok(res.headers.get("Content-Type")?.startsWith("text/plain"), "Content-Type 500 manquant");
});

test("400 response (invalid ticket) has correct status, body and Content-Type", async () => {
  const handler = createAuthCentralStartHandler({
    consumeOauthStartTicket: async () => null,
    getSecret: () => SECRET,
    secure: false,
    baseUrl: BASE_URL,
    authCentralHost: AUTH_CENTRAL_HOST,
  });
  const res = await handler(makeRequest("any-ticket"));

  assert.equal(res.status, 400);
  const body = await res.text();
  assert.ok(body.length > 0, "corps 400 vide");
  assert.ok(res.headers.get("Content-Type")?.startsWith("text/plain"), "Content-Type 400 manquant");
});

// ─── baseUrl ou authCentralHost absent => errorResponse, aucun fetch ─────────

test("redirects to error page without calling fetch when baseUrl is absent", async () => {
  let fetchCalled = false;
  const fetchImpl = async () => { fetchCalled = true; return makeCsrfResponse(); };
  const handler = createAuthCentralStartHandler({
    consumeOauthStartTicket: async () => "university-1",
    getSecret: () => SECRET,
    secure: false,
    authCentralHost: AUTH_CENTRAL_HOST,
    fetchImpl,
  });
  const res = await handler(makeRequest());

  assert.equal(res.status, 303);
  assert.equal(res.headers.get("Location"), ERROR_PATH);
  assert.equal(res.headers.getSetCookie().length, 0, "aucun Set-Cookie attendu");
  assert.equal(fetchCalled, false);
});

test("redirects to error page without calling fetch when authCentralHost is absent", async () => {
  let fetchCalled = false;
  const fetchImpl = async () => { fetchCalled = true; return makeCsrfResponse(); };
  const handler = createAuthCentralStartHandler({
    consumeOauthStartTicket: async () => "university-1",
    getSecret: () => SECRET,
    secure: false,
    baseUrl: BASE_URL,
    fetchImpl,
  });
  const res = await handler(makeRequest());

  assert.equal(res.status, 303);
  assert.equal(res.headers.get("Location"), ERROR_PATH);
  assert.equal(res.headers.getSetCookie().length, 0, "aucun Set-Cookie attendu");
  assert.equal(fetchCalled, false);
});

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

// ─── CSRF en échec : 303 vers /auth-central/error (aucun Set-Cookie tx) ───────

test("redirects to error page when CSRF request fails (no tx Set-Cookie)", async () => {
  const fetchImpl = async () => makeCsrfResponse({ status: 500 });
  const handler = createHandler(fetchImpl);
  const res = await handler(makeRequest());

  assert.equal(res.status, 303);
  assert.equal(res.headers.get("Location"), ERROR_PATH);
  const setCookies = res.headers.getSetCookie();
  assert.equal(setCookies.length, 0, "aucun Set-Cookie attendu sur erreur");
});

// ─── Signin répond 200 : 303 vers /auth-central/error ────────────────────────

test("redirects to error page when signin responds with 200 instead of 302/303", async () => {
  const fetchImpl = async (url) => {
    if (url.endsWith("/api/auth/csrf")) return makeCsrfResponse();
    return makeSigninResponse({ status: 200, location: null });
  };
  const handler = createHandler(fetchImpl);
  const res = await handler(makeRequest());

  assert.equal(res.status, 303);
  assert.equal(res.headers.get("Location"), ERROR_PATH);
});

// ─── Location hors accounts.google.com : 303 vers /auth-central/error ────────

test("redirects to error page when Location is not accounts.google.com", async () => {
  const fetchImpl = async (url) => {
    if (url.endsWith("/api/auth/csrf")) return makeCsrfResponse();
    return makeSigninResponse({ location: "https://evil.example.com/redirect" });
  };
  const handler = createHandler(fetchImpl);
  const res = await handler(makeRequest());

  assert.equal(res.status, 303);
  assert.equal(res.headers.get("Location"), ERROR_PATH);
});

// ─── baseUrl ≠ authCentralHost : 303 vers /auth-central/error, aucun fetch ───

test("redirects to error page without calling fetch when baseUrl host differs from authCentralHost", async () => {
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
  assert.equal(res.headers.get("Location"), ERROR_PATH);
  assert.equal(fetchCalled, false);
});

// ─── Erreur réseau : 303 vers /auth-central/error ────────────────────────────

test("redirects to error page on network error", async () => {
  const fetchImpl = async () => { throw new Error("network error"); };
  const handler = createHandler(fetchImpl);
  const res = await handler(makeRequest());

  assert.equal(res.status, 303);
  assert.equal(res.headers.get("Location"), ERROR_PATH);
});

// ─── Plafond dépassé (fetchTimeoutMs: 1 ms) : 303 vers /auth-central/error ───

test("redirects to error page when fetch times out (fetchTimeoutMs: 1)", async () => {
  const fetchImpl = async (url, opts) => {
    return new Promise((_, reject) => {
      if (opts?.signal?.aborted) {
        reject(new DOMException("Aborted", "AbortError"));
        return;
      }
      opts?.signal?.addEventListener("abort", () => {
        reject(new DOMException("Aborted", "AbortError"));
      });
    });
  };

  const handler = createAuthCentralStartHandler({
    consumeOauthStartTicket: async () => "university-1",
    getSecret: () => SECRET,
    secure: false,
    baseUrl: BASE_URL,
    authCentralHost: AUTH_CENTRAL_HOST,
    fetchImpl,
    fetchTimeoutMs: 1,
  });
  const res = await handler(makeRequest());

  assert.equal(res.status, 303);
  assert.equal(res.headers.get("Location"), ERROR_PATH);
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
