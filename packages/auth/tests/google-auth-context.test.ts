import assert from "node:assert/strict";
import test from "node:test";
import {
  consumeGoogleAuthContext,
  GOOGLE_AUTH_CONTEXT_TTL_MS,
  googleAuthContexts,
  GoogleAuthContextStore,
  recordGoogleAuthContext,
} from "../src/google-auth-context";
import { createAuthOptions } from "../src/index";

const NOW = 1_800_000_000_000;

function createOptions(overrides: Partial<Parameters<typeof recordGoogleAuthContext>[0]> = {}) {
  return {
    provider: "google",
    providerAccountId: "google-account",
    email: "student@example.test",
    surface: "web" as const,
    getCurrentUniversityId: async () => "legacy-university",
    now: NOW,
    store: new GoogleAuthContextStore(),
    ...overrides,
  };
}

test("records the resolver university in the per-account Google context", async () => {
  const options = createOptions({
    resolveGoogleUniversityId: async () => "central-university",
  });
  const result = await recordGoogleAuthContext(options);

  assert.deepEqual(result, { accepted: true, universityId: "central-university" });
  assert.deepEqual(
    consumeGoogleAuthContext(options.store, "google-account", NOW),
    {
      email: "student@example.test",
      universityId: "central-university",
      at: NOW,
    },
  );
});

test("refuses a null resolver result without retaining a Google context", async () => {
  const options = createOptions({ resolveGoogleUniversityId: async () => null });
  const result = await recordGoogleAuthContext(options);

  assert.deepEqual(result, { accepted: false, universityId: null });
  assert.equal(options.store.has("web:google-account"), false);
});

test("does not add non-Google providers to the Google context store", async () => {
  let resolverCalls = 0;
  const options = createOptions({
    provider: "credentials",
    resolveGoogleUniversityId: async () => {
      resolverCalls++;
      return "central-university";
    },
  });
  const result = await recordGoogleAuthContext(options);

  assert.deepEqual(result, { accepted: false, universityId: null });
  assert.equal(resolverCalls, 0);
  assert.equal(options.store.has("web:google-account"), false);
});

test("preserves the current tenant resolver when no transaction resolver is configured", async () => {
  let currentTenantCalls = 0;
  const options = createOptions({
    getCurrentUniversityId: async () => {
      currentTenantCalls++;
      return "legacy-university";
    },
  });
  const result = await recordGoogleAuthContext(options);

  assert.deepEqual(result, { accepted: true, universityId: "legacy-university" });
  assert.equal(currentTenantCalls, 1);
  assert.equal(
    consumeGoogleAuthContext(options.store, "google-account", NOW)?.universityId,
    "legacy-university",
  );
});

test("adapter context consumption returns the stored tenant once", async () => {
  const options = createOptions({
    resolveGoogleUniversityId: async () => "central-university",
  });
  await recordGoogleAuthContext(options);

  assert.equal(
    consumeGoogleAuthContext(options.store, "google-account", NOW)?.universityId,
    "central-university",
  );
  assert.equal(consumeGoogleAuthContext(options.store, "google-account", NOW), null);
});

test("refuses an expired context after sixty seconds", async () => {
  const options = createOptions({
    resolveGoogleUniversityId: async () => "central-university",
  });
  await recordGoogleAuthContext(options);

  assert.equal(
    consumeGoogleAuthContext(
      options.store,
      "google-account",
      NOW + GOOGLE_AUTH_CONTEXT_TTL_MS,
    ),
    null,
  );
  assert.equal(options.store.has("web:google-account"), false);
});

test("keeps simultaneous tenant transactions isolated by Google account", async () => {
  const store = new GoogleAuthContextStore();
  const accountA = createOptions({
    providerAccountId: "google-account-a",
    resolveGoogleUniversityId: async () => "university-a",
    store,
  });
  const accountB = createOptions({
    providerAccountId: "google-account-b",
    resolveGoogleUniversityId: async () => "university-b",
    store,
  });

  await Promise.all([
    recordGoogleAuthContext(accountA),
    recordGoogleAuthContext(accountB),
  ]);

  assert.equal(
    consumeGoogleAuthContext(store, "google-account-a", NOW)?.universityId,
    "university-a",
  );
  assert.equal(
    consumeGoogleAuthContext(store, "google-account-b", NOW)?.universityId,
    "university-b",
  );
});

test("rejects a conflicting tenant context for the same in-flight Google account", async () => {
  const store = new GoogleAuthContextStore();
  const first = createOptions({
    resolveGoogleUniversityId: async () => "university-a",
    store,
  });
  const second = createOptions({
    resolveGoogleUniversityId: async () => "university-b",
    store,
  });

  assert.deepEqual(await recordGoogleAuthContext(first), {
    accepted: true,
    universityId: "university-a",
  });
  assert.deepEqual(await recordGoogleAuthContext(second), {
    accepted: false,
    universityId: null,
  });
  assert.equal(
    consumeGoogleAuthContext(store, "google-account", NOW)?.universityId,
    "university-a",
  );
});

test("keeps the admin surface without a resolver independent from web tenant context", async () => {
  let currentTenantCalls = 0;
  const options = createOptions({
    surface: "admin",
    getCurrentUniversityId: async () => {
      currentTenantCalls++;
      return "unexpected-university";
    },
  });
  const result = await recordGoogleAuthContext(options);

  assert.deepEqual(result, { accepted: true, universityId: null });
  assert.equal(currentTenantCalls, 0);
  assert.equal(
    consumeGoogleAuthContext(options.store, "google-account", NOW, "admin")?.universityId,
    null,
  );
});

test("adapter linkAccount refuses absent and expired contexts before database access", async () => {
  const options = createAuthOptions({
    surface: "web",
    getCurrentUniversityId: async () => "university",
  });
  const linkAccount = options.adapter?.linkAccount;
  assert.ok(linkAccount);

  const account = {
    userId: "user-id",
    type: "oauth" as const,
    provider: "google",
    providerAccountId: "missing-account-context",
  };
  await assert.rejects(linkAccount(account), /Liaison Google refusee/);

  const now = Date.now();
  googleAuthContexts.record(
    "web:expired-account-context",
    { email: "student@example.test", universityId: "university", at: now - GOOGLE_AUTH_CONTEXT_TTL_MS },
    now,
  );
  await assert.rejects(
    linkAccount({ ...account, providerAccountId: "expired-account-context" }),
    /Liaison Google refusee/,
  );
});
