import assert from "node:assert/strict";
import test from "node:test";
import { createAuthOptions } from "../src/index";
import { googleAuthContexts } from "../src/google-auth-context";
import { verifyUniversitySignupToken } from "../src/university-signup-token";
import { AUTH_ADMIN_GOOGLE_ERROR_PATH } from "../src/admin-google-signin";

const SECRET = "test-secret-long-enough-for-hkdf-32bytes";
process.env.NEXTAUTH_SECRET = SECRET;

const SIGNUP_RESOLVER = async () => ({ flow: "university_signup" as const });
const SIGNUP_URL = "http://inscription-admin.localhost:3001/university-signup?token=";

function createFakeGoogleAuthContextService() {
  const records: Array<{ surface?: string; email: string; universityId: string | null }> = [];
  const deletes: string[] = [];
  return {
    records,
    deletes,
    service: {
      async record(input: { providerAccountId: string; surface?: "admin" | "web"; email: string; universityId: string | null; now: number; ttlMs?: number }) {
        records.push({ surface: input.surface, email: input.email, universityId: input.universityId });
        return { accepted: true };
      },
      async consume() {
        return null;
      },
      async delete(providerAccountId: string, surface: "admin" | "web") {
        deletes.push(`${surface}:${providerAccountId}`);
      },
    },
  };
}

async function runSignIn(overrides: Record<string, unknown> = {}) {
  const originalMethods = { ...googleAuthContexts };
  const fake = createFakeGoogleAuthContextService();
  Object.assign(googleAuthContexts, fake.service);
  const emittedTokens: string[] = [];

  try {
    const options = createAuthOptions({
      surface: "admin",
      isAuthAdminCentral: true,
      getCurrentUniversityId: async () => "legacy-univ",
      resolveGoogleUniversityId: SIGNUP_RESOLVER,
      resolveUniversitySignupUrl: async (token: string) => {
        emittedTokens.push(token);
        return SIGNUP_URL + encodeURIComponent(token);
      },
      getUserByAccount: async () => null,
      getUserByEmail: async () => null,
      ...overrides,
    });
    const signIn = options.callbacks?.signIn;
    assert.ok(signIn);
    const result = await signIn({
      user: { id: "google-new", email: "new-admin@example.com", name: "Ada", image: "https://example.com/a.png" },
      account: { provider: "google", providerAccountId: "acc-google-new", type: "oauth" },
      profile: { email: "new-admin@example.com", email_verified: true },
    });
    return { result, emittedTokens, records: fake.records, deletes: fake.deletes };
  } finally {
    Object.assign(googleAuthContexts, originalMethods);
  }
}

const existingUser = {
  id: "user-existing",
  name: "Existing",
  email: "new-admin@example.com",
  emailVerified: new Date("2026-01-01T00:00:00Z"),
  image: null,
  role: "university_admin",
  universityId: "university-1",
};

test("nouveau compte Google : jeton d'inscription signé puis URL de l'hôte d'inscription", async () => {
  const { result, emittedTokens, records, deletes } = await runSignIn();

  assert.equal(emittedTokens.length, 1);
  assert.equal(result, SIGNUP_URL + encodeURIComponent(emittedTokens[0]));
  assert.deepEqual(verifyUniversitySignupToken(emittedTokens[0], Date.now(), SECRET), {
    email: "new-admin@example.com",
    name: "Ada",
    image: "https://example.com/a.png",
    providerAccountId: "acc-google-new",
  });
  assert.deepEqual(records, [{ surface: "admin", email: "new-admin@example.com", universityId: null }]);
  assert.deepEqual(deletes, ["admin:acc-google-new"]);
});

test("compte Google déjà lié : refus vers /auth-admin/error, aucun jeton", async () => {
  const { result, emittedTokens, deletes } = await runSignIn({ getUserByAccount: async () => existingUser });
  assert.equal(result, AUTH_ADMIN_GOOGLE_ERROR_PATH);
  assert.deepEqual(emittedTokens, []);
  assert.deepEqual(deletes, ["admin:acc-google-new"]);
});

test("adresse e-mail déjà utilisée : refus vers /auth-admin/error, aucun jeton", async () => {
  for (const role of ["university_admin", "super_admin", "student"]) {
    const { result, emittedTokens } = await runSignIn({
      getUserByEmail: async () => ({ ...existingUser, role }),
    });
    assert.equal(result, AUTH_ADMIN_GOOGLE_ERROR_PATH);
    assert.deepEqual(emittedTokens, []);
  }
});

test("hôte non central : refus vers /auth-admin/error, aucun jeton", async () => {
  const { result, emittedTokens } = await runSignIn({ isAuthAdminCentral: false });
  assert.equal(result, AUTH_ADMIN_GOOGLE_ERROR_PATH);
  assert.deepEqual(emittedTokens, []);
});

test("URL d'inscription absente, nulle ou en erreur : refus vers /auth-admin/error", async () => {
  for (const resolveUniversitySignupUrl of [
    undefined,
    async () => null,
    async () => {
      throw new Error("url");
    },
  ]) {
    const { result, deletes } = await runSignIn({ resolveUniversitySignupUrl });
    assert.equal(result, AUTH_ADMIN_GOOGLE_ERROR_PATH);
    assert.deepEqual(deletes, ["admin:acc-google-new"]);
  }
});

test("e-mail Google non vérifié : refus avant tout jeton", async () => {
  const originalMethods = { ...googleAuthContexts };
  const fake = createFakeGoogleAuthContextService();
  Object.assign(googleAuthContexts, fake.service);
  let called = false;
  try {
    const options = createAuthOptions({
      surface: "admin",
      isAuthAdminCentral: true,
      getCurrentUniversityId: async () => "legacy-univ",
      resolveGoogleUniversityId: SIGNUP_RESOLVER,
      resolveUniversitySignupUrl: async () => {
        called = true;
        return SIGNUP_URL;
      },
      getUserByAccount: async () => null,
      getUserByEmail: async () => null,
    });
    const result = await options.callbacks!.signIn!({
      user: { id: "google-new", email: "new-admin@example.com" },
      account: { provider: "google", providerAccountId: "acc-google-new", type: "oauth" },
      profile: { email: "new-admin@example.com", email_verified: false },
    });
    assert.equal(result, false);
    assert.equal(called, false);
    assert.deepEqual(fake.records, []);
  } finally {
    Object.assign(googleAuthContexts, originalMethods);
  }
});
