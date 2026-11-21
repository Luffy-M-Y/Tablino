import assert from "node:assert/strict";
import test from "node:test";
import {
  createAuthAdminStartHandler,
  getAuthAdminStartUrl,
} from "../src/lib/auth-admin-start.mjs";
import {
  AUTH_ADMIN_TRANSACTION_COOKIE_NAME,
  parseAuthAdminTransaction,
  verifyAuthAdminTransaction,
} from "../src/lib/auth-admin-transaction.mjs";

const CENTRAL_HOST = "auth-admin.localhost:3001";
const BASE_URL = `http://${CENTRAL_HOST}`;
const SECRET = "test-nextauth-secret";
const UNIVERSITY_ID = "university-test";
const GOOGLE_URL = "https://accounts.google.com/o/oauth2/v2/auth?client_id=test";

function makeRequest({ host = CENTRAL_HOST, ticket = "start-ticket", kind = "university", omitKind = false } = {}) {
  const params = {};
  if (ticket !== undefined) params.ticket = ticket;
  if (!omitKind && kind !== undefined) params.kind = kind;
  return new Request(`http://${host}/auth-admin/start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      host,
    },
    body: new URLSearchParams(params),
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

test("admin start rejects missing, empty, or unknown kind", async () => {
  const handler = createHandler();
  for (const kind of [undefined, "", "unknown", "student", "super"]) {
    const response = await handler(makeRequest({ kind, omitKind: kind === undefined }));
    assert.equal(response.status, 400);
  }
});

test("admin start processes invitation kind with service and sets flow=invitation", async () => {
  let ticketReceived;
  const handler = createHandler({
    consumeAdminInvitationOauthStartTicket: async (ticket) => {
      ticketReceived = ticket;
      return { invitationId: "invitation-123", transactionId: "tx-inv-456" };
    },
    baseUrl: undefined,
  });

  const response = await handler(makeRequest({ kind: "invitation", ticket: "inv-ticket-abc" }));
  assert.equal(ticketReceived, "inv-ticket-abc");
  assert.equal(response.status, 303);

  const cookie = response.headers.get("Set-Cookie") ?? "";
  const transaction = cookie.split(";")[0]?.slice(`${AUTH_ADMIN_TRANSACTION_COOKIE_NAME}=`.length);
  const parsed = parseAuthAdminTransaction(transaction, {
    now: new Date("2026-11-13T21:00:00.000Z"),
    secret: SECRET,
  });
  assert.deepEqual(parsed, {
    flow: "invitation",
    invitationId: "invitation-123",
    transactionId: "tx-inv-456",
  });
});

test("admin start processes super_login kind with service and sets flow=super_login", async () => {
  let ticketReceived;
  const handler = createHandler({
    consumeAdminSuperLoginOauthStartTicket: async (ticket) => {
      ticketReceived = ticket;
      return { transactionId: "tx-super-789" };
    },
    baseUrl: undefined,
  });

  const response = await handler(makeRequest({ kind: "super_login", ticket: "super-ticket-xyz" }));
  assert.equal(ticketReceived, "super-ticket-xyz");
  assert.equal(response.status, 303);

  const cookie = response.headers.get("Set-Cookie") ?? "";
  const transaction = cookie.split(";")[0]?.slice(`${AUTH_ADMIN_TRANSACTION_COOKIE_NAME}=`.length);
  const parsed = parseAuthAdminTransaction(transaction, {
    now: new Date("2026-11-13T21:00:00.000Z"),
    secret: SECRET,
  });
  assert.deepEqual(parsed, {
    flow: "super_login",
    transactionId: "tx-super-789",
  });
});

test("admin start rejects invitation and super_login when service fails or ticket is invalid", async () => {
  const handler = createHandler({
    consumeAdminInvitationOauthStartTicket: async () => null,
    consumeAdminSuperLoginOauthStartTicket: async () => null,
  });

  const res1 = await handler(makeRequest({ kind: "invitation", ticket: "bad-ticket" }));
  assert.equal(res1.status, 400);

  const res2 = await handler(makeRequest({ kind: "super_login", ticket: "bad-ticket" }));
  assert.equal(res2.status, 400);
});
