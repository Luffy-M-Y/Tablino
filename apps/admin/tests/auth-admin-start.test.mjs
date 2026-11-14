import assert from "node:assert/strict";
import test from "node:test";
import {
  createAuthAdminStartHandler,
  getAuthAdminStartUrl,
} from "../src/lib/auth-admin-start.mjs";
import {
  AUTH_ADMIN_TRANSACTION_COOKIE_NAME,
  verifyAuthAdminTransaction,
} from "../src/lib/auth-admin-transaction.mjs";

const CENTRAL_HOST = "auth-admin.localhost:3001";
const BASE_URL = `http://${CENTRAL_HOST}`;
const SECRET = "test-nextauth-secret";
const UNIVERSITY_ID = "university-test";
const GOOGLE_URL = "https://accounts.google.com/o/oauth2/v2/auth?client_id=test";

function makeRequest({ host = CENTRAL_HOST, ticket = "start-ticket" } = {}) {
  return new Request(`http://${host}/auth-admin/start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      host,
    },
    body: new URLSearchParams({ ticket }),
  });
}

function createHandler(options = {}) {
  return createAuthAdminStartHandler({
    consumeOauthStartTicket: async () => UNIVERSITY_ID,
    getSecret: () => SECRET,
    secure: false,
    baseUrl: BASE_URL,
    authAdminCentralHost: CENTRAL_HOST,
    now: () => new Date("2026-11-13T21:00:00.000Z"),
    ...options,
  });
}

test("admin start rejects requests not sent to the exact central host", async () => {
  const response = await createHandler()(makeRequest({ host: "iscom-admin.localhost:3001" }));
  assert.equal(response.status, 404);
});

test("admin start URL is built only from a valid central host", () => {
  assert.equal(
    getAuthAdminStartUrl(CENTRAL_HOST, { secure: false }),
    `http://${CENTRAL_HOST}/auth-admin/start`,
  );
  assert.equal(
    getAuthAdminStartUrl("https://auth-admin.example.test", { secure: true }),
    null,
  );
  assert.equal(getAuthAdminStartUrl(undefined, { secure: true }), null);
});

test("admin start consumes tickets without placing the ticket in the redirect URL", async () => {
  let consumedSurface;
  const handler = createHandler({
    consumeOauthStartTicket: async (_ticket, surface) => {
      consumedSurface = surface;
      return UNIVERSITY_ID;
    },
    baseUrl: undefined,
  });
  const response = await handler(makeRequest());

  assert.equal(consumedSurface, "admin");
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("Location"), `http://${CENTRAL_HOST}/auth-admin/signin`);
  assert.equal(response.headers.get("Location")?.includes("start-ticket"), false);
  const cookie = response.headers.get("Set-Cookie") ?? "";
  const transaction = cookie.split(";")[0]?.slice(`${AUTH_ADMIN_TRANSACTION_COOKIE_NAME}=`.length);
  assert.equal(
    verifyAuthAdminTransaction(transaction, {
      now: new Date("2026-11-13T21:00:00.000Z"),
      secret: SECRET,
    }),
    UNIVERSITY_ID,
  );
});

test("admin start sends the consumed transaction cookie and CSRF cookie to NextAuth", async () => {
  let signinRequest;
  const fetchImpl = async (input, init) => {
    if (String(input).endsWith("/api/auth/csrf")) {
      return new Response(JSON.stringify({ csrfToken: "csrf-test" }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": "next-auth.csrf-token=csrf-cookie; Path=/",
        },
      });
    }
    signinRequest = { input: String(input), init };
    return new Response(null, { status: 303, headers: { Location: GOOGLE_URL } });
  };
  const response = await createHandler({ fetchImpl })(makeRequest());

  assert.equal(response.status, 303);
  assert.equal(response.headers.get("Location"), GOOGLE_URL);
  assert.equal(signinRequest?.input.endsWith("/api/auth/signin/google"), true);
  assert.equal(
    new URLSearchParams(signinRequest?.init.body).get("callbackUrl"),
    "/auth-admin/transfer",
  );
  assert.match(signinRequest?.init.headers.Cookie ?? "", /tablino-admin-oauth-tx=/);
  assert.match(signinRequest?.init.headers.Cookie ?? "", /csrf-cookie/);
  assert.equal(signinRequest?.init.body.includes("start-ticket"), false);
  assert.match(response.headers.get("Set-Cookie") ?? "", /tablino-admin-oauth-tx=/);
});

test("admin start falls back to signin when the direct OAuth flow is unavailable", async () => {
  const response = await createHandler({
    fetchImpl: async () => new Response("unavailable", { status: 503 }),
  })(makeRequest());

  assert.equal(response.status, 303);
  assert.equal(response.headers.get("Location"), `http://${CENTRAL_HOST}/auth-admin/signin`);
  assert.match(response.headers.get("Set-Cookie") ?? "", /tablino-admin-oauth-tx=/);
});
