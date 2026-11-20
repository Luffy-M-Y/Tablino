import assert from "node:assert/strict";
import test from "node:test";
import {
  consumeGoogleAuthContext,
  GOOGLE_AUTH_CONTEXT_TTL_MS,
  googleAuthContexts,
  type GoogleAuthContext,
  type GoogleAuthContextService,
  type GoogleAuthSurface,
  recordGoogleAuthContext,
} from "../src/google-auth-context";
import { createAuthOptions } from "../src/index";

const NOW = 1_800_000_000_000;

function createFakeGoogleAuthContextService(): GoogleAuthContextService & {
  has: (key: string) => boolean;
} {
  const contexts = new Map<string, GoogleAuthContext>();

  const prune = (now: number) => {
    for (const [key, ctx] of contexts) {
      if (now - ctx.at >= GOOGLE_AUTH_CONTEXT_TTL_MS) {
        contexts.delete(key);
      }
    }
  };

  return {
    has(key: string) {
      return contexts.has(key);
    },
    async record(input) {
      const surface = input.surface ?? "web";
      const key = `${surface}:${input.providerAccountId}`;
      const ctx: GoogleAuthContext = {
        email: input.email,
        universityId: input.universityId,
        at: input.now,
      };

      prune(input.now);

      const existing = contexts.get(key);
      if (
        existing
        && (
          existing.email !== ctx.email
          || existing.universityId !== ctx.universityId
        )
      ) {
        return { accepted: false };
      }

      contexts.set(key, ctx);
      return { accepted: true };
    },

    async consume(providerAccountId: string, now: number, surface: GoogleAuthSurface = "web") {
      const key = providerAccountId.includes(":")
        ? providerAccountId
        : `${surface}:${providerAccountId}`;
      const ctx = contexts.get(key);
      contexts.delete(key);
      if (!ctx || now - ctx.at >= GOOGLE_AUTH_CONTEXT_TTL_MS) {
        return null;
      }
      return ctx;
    },

    async delete(providerAccountId: string, surface: GoogleAuthSurface = "web") {
      const key = providerAccountId.includes(":")
        ? providerAccountId
        : `${surface}:${providerAccountId}`;
      contexts.delete(key);
    },
  };
}

function createOptions(overrides: Partial<Parameters<typeof recordGoogleAuthContext>[0]> = {}) {
  return {
    provider: "google",
    providerAccountId: "google-account",
    email: "student@example.test",
    surface: "web" as const,
    getCurrentUniversityId: async () => "legacy-university",
    now: NOW,
    store: createFakeGoogleAuthContextService(),
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
    await consumeGoogleAuthContext(options.store, "google-account", NOW),
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
    (await consumeGoogleAuthContext(options.store, "google-account", NOW))?.universityId,
    "legacy-university",
  );
});

test("adapter context consumption returns the stored tenant once", async () => {
  const options = createOptions({
    resolveGoogleUniversityId: async () => "central-university",
  });
  await recordGoogleAuthContext(options);

  assert.equal(
    (await consumeGoogleAuthContext(options.store, "google-account", NOW))?.universityId,
    "central-university",
  );
  assert.equal(await consumeGoogleAuthContext(options.store, "google-account", NOW), null);
});

test("refuses an expired context after sixty seconds", async () => {
  const options = createOptions({
    resolveGoogleUniversityId: async () => "central-university",
  });
  await recordGoogleAuthContext(options);

  assert.equal(
    await consumeGoogleAuthContext(
      options.store,
      "google-account",
      NOW + GOOGLE_AUTH_CONTEXT_TTL_MS,
    ),
    null,
  );
  assert.equal(options.store.has("web:google-account"), false);
});

test("keeps simultaneous tenant transactions isolated by Google account", async () => {
  const store = createFakeGoogleAuthContextService();
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
    (await consumeGoogleAuthContext(store, "google-account-a", NOW))?.universityId,
    "university-a",
  );
  assert.equal(
    (await consumeGoogleAuthContext(store, "google-account-b", NOW))?.universityId,
    "university-b",
  );
});

test("rejects a conflicting tenant context for the same in-flight Google account", async () => {
  const store = createFakeGoogleAuthContextService();
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
    (await consumeGoogleAuthContext(store, "google-account", NOW))?.universityId,
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
    (await consumeGoogleAuthContext(options.store, "google-account", NOW, "admin"))?.universityId,
    null,
  );
});

test("adapter linkAccount refuses absent and expired contexts before database access", async () => {
  const originalMethods = {
    record: googleAuthContexts.record,
    consume: googleAuthContexts.consume,
    delete: googleAuthContexts.delete,
  };
  const store = createFakeGoogleAuthContextService();
  Object.assign(googleAuthContexts, store);

  try {
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
    await googleAuthContexts.record({
      providerAccountId: "expired-account-context",
      surface: "web",
      email: "student@example.test",
      universityId: "university",
      now: now - GOOGLE_AUTH_CONTEXT_TTL_MS,
    });
    await assert.rejects(
      linkAccount({ ...account, providerAccountId: "expired-account-context" }),
      /Liaison Google refusee/,
    );
  } finally {
    Object.assign(googleAuthContexts, originalMethods);
  }
});

test("recordGoogleAuthContext refuse un objet { flow: 'super_login' } sans transactionId", async () => {
  const options = createOptions({
    resolveGoogleUniversityId: async () => ({ flow: "super_login" }),
  });
  const result = await recordGoogleAuthContext(options);
  assert.deepEqual(result, { accepted: false, universityId: null });
});

test("recordGoogleAuthContext refuse un objet { flow: 'super_login' } avec transactionId non string", async () => {
  const options = createOptions({
    resolveGoogleUniversityId: async () => ({ flow: "super_login", transactionId: 12345 }),
  });
  const result = await recordGoogleAuthContext(options);
  assert.deepEqual(result, { accepted: false, universityId: null });
});
