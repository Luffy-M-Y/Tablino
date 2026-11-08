import assert from "node:assert/strict";
import test from "node:test";
import { verifyTurnstileToken } from "../src/turnstile";

const expectedAction = "login";
const options = {
  secret: "test-secret",
  expectedHostname: "example.com",
};

function successfulFetcher(overrides: Record<string, unknown> = {}): typeof fetch {
  return async () => new Response(JSON.stringify({
    success: true,
    action: expectedAction,
    hostname: "example.com",
    ...overrides,
  }), { status: 200 });
}

test("Turnstile accepts a valid token with the expected action and hostname", async () => {
  const result = await verifyTurnstileToken("valid-token", expectedAction, {
    ...options,
    fetcher: successfulFetcher(),
  });

  assert.deepEqual(result, { ok: true });
});

test("Turnstile accepts the request hostname when explicitly provided", async () => {
  const result = await verifyTurnstileToken("valid-token", expectedAction, {
    secret: options.secret,
    expectedHostname: "ISCOM.localhost",
    fetcher: successfulFetcher({ hostname: "iscom.localhost" }),
  });

  assert.deepEqual(result, { ok: true });
});

test("Turnstile keeps NEXTAUTH_URL hostname fallback when expectedHostname is omitted", async () => {
  const previousNextAuthUrl = process.env.NEXTAUTH_URL;
  process.env.NEXTAUTH_URL = "https://legacy.example.test:3000";

  try {
    const result = await verifyTurnstileToken("valid-token", expectedAction, {
      secret: options.secret,
      fetcher: successfulFetcher({ hostname: "legacy.example.test" }),
    });

    assert.deepEqual(result, { ok: true });
  } finally {
    if (previousNextAuthUrl === undefined) {
      delete process.env.NEXTAUTH_URL;
    } else {
      process.env.NEXTAUTH_URL = previousNextAuthUrl;
    }
  }
});

test("Turnstile sends Siteverify the secret and response token", async () => {
  let requestUrl = "";
  let requestBody = "";
  const fetcher: typeof fetch = async (input, init) => {
    requestUrl = String(input);
    requestBody = String(init?.body);
    return new Response(JSON.stringify({
      success: true,
      action: expectedAction,
      hostname: "example.com",
    }), { status: 200 });
  };

  await verifyTurnstileToken("valid-token", expectedAction, { ...options, fetcher });

  assert.equal(requestUrl, "https://challenges.cloudflare.com/turnstile/v0/siteverify");
  assert.deepEqual(JSON.parse(requestBody), {
    secret: options.secret,
    response: "valid-token",
  });
});

test("Turnstile fails closed when configuration is missing", async () => {
  const result = await verifyTurnstileToken("valid-token", expectedAction, {
    fetcher: successfulFetcher(),
  });

  assert.deepEqual(result, { ok: false, reason: "missing_config" });
});

test("Turnstile rejects empty and oversized tokens without calling Siteverify", async () => {
  let calls = 0;
  const fetcher: typeof fetch = async () => {
    calls++;
    return new Response();
  };

  const empty = await verifyTurnstileToken("", expectedAction, { ...options, fetcher });
  const oversized = await verifyTurnstileToken("x".repeat(2049), expectedAction, {
    ...options,
    fetcher,
  });

  assert.deepEqual(empty, { ok: false, reason: "invalid_token" });
  assert.deepEqual(oversized, { ok: false, reason: "invalid_token" });
  assert.equal(calls, 0);
});

test("Turnstile rejects unsuccessful Siteverify responses", async () => {
  const result = await verifyTurnstileToken("invalid-token", expectedAction, {
    ...options,
    fetcher: successfulFetcher({ success: false }),
  });

  assert.deepEqual(result, { ok: false, reason: "rejected" });
});

test("Turnstile rejects action and hostname mismatches", async () => {
  const actionResult = await verifyTurnstileToken("valid-token", expectedAction, {
    ...options,
    fetcher: successfulFetcher({ action: "signup" }),
  });
  const hostnameResult = await verifyTurnstileToken("valid-token", expectedAction, {
    ...options,
    fetcher: successfulFetcher({ hostname: "attacker.example" }),
  });

  assert.deepEqual(actionResult, { ok: false, reason: "action_mismatch" });
  assert.deepEqual(hostnameResult, { ok: false, reason: "hostname_mismatch" });
});

test("Turnstile rejects provider and network errors", async () => {
  const rejected = await verifyTurnstileToken("valid-token", expectedAction, {
    ...options,
    fetcher: async () => new Response("unavailable", { status: 503 }),
  });
  const unavailable = await verifyTurnstileToken("valid-token", expectedAction, {
    ...options,
    fetcher: async () => {
      throw new Error("network failure");
    },
  });

  assert.deepEqual(rejected, { ok: false, reason: "unavailable" });
  assert.deepEqual(unavailable, { ok: false, reason: "unavailable" });
});

test("Turnstile rejects malformed Siteverify responses", async () => {
  const invalidJson = await verifyTurnstileToken("valid-token", expectedAction, {
    ...options,
    fetcher: async () => new Response("{", { status: 200 }),
  });
  const nullResponse = await verifyTurnstileToken("valid-token", expectedAction, {
    ...options,
    fetcher: async () => new Response("null", { status: 200 }),
  });

  assert.deepEqual(invalidJson, { ok: false, reason: "unavailable" });
  assert.deepEqual(nullResponse, { ok: false, reason: "unavailable" });
});
