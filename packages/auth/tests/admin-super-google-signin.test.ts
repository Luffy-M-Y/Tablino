import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import {
  checkAdminSuperLoginGoogleEligibility,
  createAdminSuperLoginOauthTransferCode,
} from "@tablino/db";
import { createAuthOptions } from "../src/index";
import { googleAuthContexts } from "../src/google-auth-context";
import { verifySuperGoogleExistingAccountToken } from "../src/google-super-existing-account-token";
import { verifyGoogleExistingAccountToken } from "../src/google-existing-account-token";
import { AUTH_ADMIN_GOOGLE_ERROR_PATH } from "../src/admin-google-signin";

const SECRET = "test-secret-long-enough-for-hkdf-32bytes";
process.env.NEXTAUTH_SECRET = SECRET;

const SUPER_LOGIN_RESOLVER = async () => ({
  flow: "super_login" as const,
  transactionId: "tx-super-test-789",
});

function createFakeGoogleAuthContextService() {
  const map = new Map<string, { email: string; universityId: string | null; at: number; expiresAt: number }>();
  return {
    async record(input: { providerAccountId: string; surface?: "admin" | "web"; email: string; universityId: string | null; now: number; ttlMs?: number }) {
      const key = `${input.surface ?? "web"}:${input.providerAccountId}`;
      const expiresAt = input.now + (input.ttlMs ?? 60_000);
      map.set(key, { email: input.email, universityId: input.universityId, at: input.now, expiresAt });
      return { accepted: true };
    },
    async consume(providerAccountId: string, now: number, surface = "web" as const) {
      const key = `${surface}:${providerAccountId}`;
      const found = map.get(key);
      if (!found) return null;
      map.delete(key);
      if (found.expiresAt <= now) return null;
      return { email: found.email, universityId: found.universityId, at: found.at };
    },
    async delete(providerAccountId: string, surface: "admin" | "web") {
      map.delete(`${surface}:${providerAccountId}`);
    },
  };
}

function createValidSuperUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-super-1",
    name: "Super User",
    email: "editor@example.com",
    emailVerified: new Date("2026-01-01T00:00:00Z"),
    image: null,
    role: "super_admin_editor",
    universityId: null,
    ...overrides,
  };
}

function createValidSecurityDetails(overrides: Record<string, unknown> = {}) {
  return {
    passwordHash: "$2a$12$validPasswordHashForEditorUser123",
    revokedAt: null,
    ...overrides,
  };
}

test("editor actif accepté : émet le jeton super et redirige", async () => {
  const originalMethods = { ...googleAuthContexts };
  Object.assign(googleAuthContexts, createFakeGoogleAuthContextService());

  try {
    let emittedToken: string | null = null;
    const user = createValidSuperUser({ role: "super_admin_editor", email: "editor@example.com" });
    const options = createAuthOptions({
      surface: "admin",
      isAuthAdminCentral: true,
      getCurrentUniversityId: async () => "legacy-univ",
      resolveGoogleUniversityId: SUPER_LOGIN_RESOLVER,
      getSuperAdminSecurityDetails: async () => createValidSecurityDetails(),
      resolveGoogleSuperExistingAccountUrl: async (token: string) => {
        emittedToken = token;
        return `/login?googleExisting=${token}`;
      },
      getUserByAccount: async () => null,
      getUserByEmail: async () => user,
    });

    const signIn = options.callbacks?.signIn;
    assert.ok(signIn);

    const result = await signIn({
      user: { id: "user-super-1", email: "editor@example.com" },
      account: { provider: "google", providerAccountId: "acc-google-editor", type: "oauth" },
      profile: { email: "editor@example.com", email_verified: true },
    });

    assert.equal(typeof result, "string");
    assert.ok((result as string).startsWith("/login?googleExisting="));
    assert.ok(emittedToken !== null);

    const verified = verifySuperGoogleExistingAccountToken(emittedToken!, { secret: SECRET });
    assert.deepEqual(verified, { email: "editor@example.com" });
    assert.equal("universityId" in (verified as object), false);

    // Isolation : le jeton super n'est pas déchiffrable par le vérificateur université
    const uniVerified = verifyGoogleExistingAccountToken(emittedToken!, { secret: SECRET });
    assert.equal(uniVerified, null);
  } finally {
    Object.assign(googleAuthContexts, originalMethods);
  }
});

test("lector actif accepté : émet le jeton super et redirige", async () => {
  const originalMethods = { ...googleAuthContexts };
  Object.assign(googleAuthContexts, createFakeGoogleAuthContextService());

  try {
    let emittedToken: string | null = null;
    const user = createValidSuperUser({ role: "super_admin_lector", email: "lector@example.com" });
    const options = createAuthOptions({
      surface: "admin",
      isAuthAdminCentral: true,
      getCurrentUniversityId: async () => "legacy-univ",
      resolveGoogleUniversityId: SUPER_LOGIN_RESOLVER,
      getSuperAdminSecurityDetails: async () => createValidSecurityDetails(),
      resolveGoogleSuperExistingAccountUrl: async (token: string) => {
        emittedToken = token;
        return `/login?googleExisting=${token}`;
      },
      getUserByAccount: async () => null,
      getUserByEmail: async () => user,
    });

    const signIn = options.callbacks?.signIn;
    assert.ok(signIn);

    const result = await signIn({
      user: { id: "user-super-2", email: "lector@example.com" },
      account: { provider: "google", providerAccountId: "acc-google-lector", type: "oauth" },
      profile: { email: "lector@example.com", email_verified: true },
    });

    assert.equal(typeof result, "string");
    assert.ok((result as string).startsWith("/login?googleExisting="));
    assert.ok(emittedToken !== null);

    const verified = verifySuperGoogleExistingAccountToken(emittedToken!, { secret: SECRET });
    assert.deepEqual(verified, { email: "lector@example.com" });
  } finally {
    Object.assign(googleAuthContexts, originalMethods);
  }
});

test("chef super_admin refusé : jamais de session ni de jeton", async () => {
  const originalMethods = { ...googleAuthContexts };
  Object.assign(googleAuthContexts, createFakeGoogleAuthContextService());

  try {
    let tokenEmitted = false;
    const user = createValidSuperUser({ role: "super_admin" });
    const options = createAuthOptions({
      surface: "admin",
      isAuthAdminCentral: true,
      getCurrentUniversityId: async () => "legacy-univ",
      resolveGoogleUniversityId: SUPER_LOGIN_RESOLVER,
      getSuperAdminSecurityDetails: async () => createValidSecurityDetails(),
      resolveGoogleSuperExistingAccountUrl: async () => {
        tokenEmitted = true;
        return "/should-not-reach";
      },
      getUserByAccount: async () => null,
      getUserByEmail: async () => user,
    });

    const signIn = options.callbacks?.signIn;
    assert.ok(signIn);

    const result = await signIn({
      user: { id: "user-super-chef", email: "editor@example.com" },
      account: { provider: "google", providerAccountId: "acc-google-chef", type: "oauth" },
      profile: { email: "editor@example.com", email_verified: true },
    });

    assert.equal(result, "/auth-admin/error");
    assert.equal(tokenEmitted, false);
  } finally {
    Object.assign(googleAuthContexts, originalMethods);
  }
});

test("utilisateur révoqué refusé : réponse générique d'erreur", async () => {
  const originalMethods = { ...googleAuthContexts };
  Object.assign(googleAuthContexts, createFakeGoogleAuthContextService());

  try {
    let tokenEmitted = false;
    const user = createValidSuperUser();
    const options = createAuthOptions({
      surface: "admin",
      isAuthAdminCentral: true,
      getCurrentUniversityId: async () => "legacy-univ",
      resolveGoogleUniversityId: SUPER_LOGIN_RESOLVER,
      getSuperAdminSecurityDetails: async () => createValidSecurityDetails({
        revokedAt: new Date("2026-02-01T12:00:00Z"),
      }),
      resolveGoogleSuperExistingAccountUrl: async () => {
        tokenEmitted = true;
        return "/should-not-reach";
      },
      getUserByAccount: async () => null,
      getUserByEmail: async () => user,
    });

    const signIn = options.callbacks?.signIn;
    assert.ok(signIn);

    const result = await signIn({
      user: { id: "user-super-revoked", email: "editor@example.com" },
      account: { provider: "google", providerAccountId: "acc-google-revoked", type: "oauth" },
      profile: { email: "editor@example.com", email_verified: true },
    });

    assert.equal(result, "/auth-admin/error");
    assert.equal(tokenEmitted, false);
  } finally {
    Object.assign(googleAuthContexts, originalMethods);
  }
});

test("e-mail non vérifié refusé : réponse générique d'erreur", async () => {
  const originalMethods = { ...googleAuthContexts };
  Object.assign(googleAuthContexts, createFakeGoogleAuthContextService());

  try {
    let tokenEmitted = false;
    const user = createValidSuperUser({ emailVerified: null });
    const options = createAuthOptions({
      surface: "admin",
      isAuthAdminCentral: true,
      getCurrentUniversityId: async () => "legacy-univ",
      resolveGoogleUniversityId: SUPER_LOGIN_RESOLVER,
      getSuperAdminSecurityDetails: async () => createValidSecurityDetails(),
      resolveGoogleSuperExistingAccountUrl: async () => {
        tokenEmitted = true;
        return "/should-not-reach";
      },
      getUserByAccount: async () => null,
      getUserByEmail: async () => user,
    });

    const signIn = options.callbacks?.signIn;
    assert.ok(signIn);

    const result = await signIn({
      user: { id: "user-super-unverified", email: "editor@example.com" },
      account: { provider: "google", providerAccountId: "acc-google-unverified", type: "oauth" },
      profile: { email: "editor@example.com", email_verified: true },
    });

    assert.equal(result, "/auth-admin/error");
    assert.equal(tokenEmitted, false);
  } finally {
    Object.assign(googleAuthContexts, originalMethods);
  }
});

test("sans mot de passe refusé : réponse générique d'erreur", async () => {
  const originalMethods = { ...googleAuthContexts };
  Object.assign(googleAuthContexts, createFakeGoogleAuthContextService());

  try {
    let tokenEmitted = false;
    const user = createValidSuperUser();
    const options = createAuthOptions({
      surface: "admin",
      isAuthAdminCentral: true,
      getCurrentUniversityId: async () => "legacy-univ",
      resolveGoogleUniversityId: SUPER_LOGIN_RESOLVER,
      getSuperAdminSecurityDetails: async () => createValidSecurityDetails({
        passwordHash: null,
      }),
      resolveGoogleSuperExistingAccountUrl: async () => {
        tokenEmitted = true;
        return "/should-not-reach";
      },
      getUserByAccount: async () => null,
      getUserByEmail: async () => user,
    });

    const signIn = options.callbacks?.signIn;
    assert.ok(signIn);

    const result = await signIn({
      user: { id: "user-super-nopassword", email: "editor@example.com" },
      account: { provider: "google", providerAccountId: "acc-google-nopassword", type: "oauth" },
      profile: { email: "editor@example.com", email_verified: true },
    });

    assert.equal(result, "/auth-admin/error");
    assert.equal(tokenEmitted, false);
  } finally {
    Object.assign(googleAuthContexts, originalMethods);
  }
});

test("avec université refusé : réponse générique d'erreur", async () => {
  const originalMethods = { ...googleAuthContexts };
  Object.assign(googleAuthContexts, createFakeGoogleAuthContextService());

  try {
    let tokenEmitted = false;
    const user = createValidSuperUser({ universityId: "univ-forbidden" });
    const options = createAuthOptions({
      surface: "admin",
      isAuthAdminCentral: true,
      getCurrentUniversityId: async () => "legacy-univ",
      resolveGoogleUniversityId: SUPER_LOGIN_RESOLVER,
      getSuperAdminSecurityDetails: async () => createValidSecurityDetails(),
      resolveGoogleSuperExistingAccountUrl: async () => {
        tokenEmitted = true;
        return "/should-not-reach";
      },
      getUserByAccount: async () => null,
      getUserByEmail: async () => user,
    });

    const signIn = options.callbacks?.signIn;
    assert.ok(signIn);

    const result = await signIn({
      user: { id: "user-super-withuniv", email: "editor@example.com" },
      account: { provider: "google", providerAccountId: "acc-google-withuniv", type: "oauth" },
      profile: { email: "editor@example.com", email_verified: true },
    });

    assert.equal(result, "/auth-admin/error");
    assert.equal(tokenEmitted, false);
  } finally {
    Object.assign(googleAuthContexts, originalMethods);
  }
});

test("hôte non central refusé : réponse générique d'erreur", async () => {
  const originalMethods = { ...googleAuthContexts };
  Object.assign(googleAuthContexts, createFakeGoogleAuthContextService());

  try {
    let tokenEmitted = false;
    const user = createValidSuperUser();
    const options = createAuthOptions({
      surface: "admin",
      isAuthAdminCentral: false,
      getCurrentUniversityId: async () => "legacy-univ",
      resolveGoogleUniversityId: SUPER_LOGIN_RESOLVER,
      getSuperAdminSecurityDetails: async () => createValidSecurityDetails(),
      resolveGoogleSuperExistingAccountUrl: async () => {
        tokenEmitted = true;
        return "/should-not-reach";
      },
      getUserByAccount: async () => null,
      getUserByEmail: async () => user,
    });

    const signIn = options.callbacks?.signIn;
    assert.ok(signIn);

    const result = await signIn({
      user: { id: "user-super-noncentral", email: "editor@example.com" },
      account: { provider: "google", providerAccountId: "acc-google-noncentral", type: "oauth" },
      profile: { email: "editor@example.com", email_verified: true },
    });

    assert.equal(result, "/auth-admin/error");
    assert.equal(tokenEmitted, false);
  } finally {
    Object.assign(googleAuthContexts, originalMethods);
  }
});

test("utilisateur introuvable en base : refus générique et contexte supprimé", async () => {
  const originalMethods = { ...googleAuthContexts };
  Object.assign(googleAuthContexts, createFakeGoogleAuthContextService());

  try {
    let tokenEmitted = false;
    const options = createAuthOptions({
      surface: "admin",
      isAuthAdminCentral: true,
      getCurrentUniversityId: async () => "legacy-univ",
      resolveGoogleUniversityId: SUPER_LOGIN_RESOLVER,
      getSuperAdminSecurityDetails: async () => createValidSecurityDetails(),
      resolveGoogleSuperExistingAccountUrl: async () => {
        tokenEmitted = true;
        return "/should-not-reach";
      },
      getUserByAccount: async () => null,
      getUserByEmail: async () => null,
    });

    const signIn = options.callbacks?.signIn;
    assert.ok(signIn);

    const result = await signIn({
      user: { id: "user-unknown", email: "unknown@example.com" },
      account: { provider: "google", providerAccountId: "acc-google-unknown", type: "oauth" },
      profile: { email: "unknown@example.com", email_verified: true },
    });

    assert.equal(result, "/auth-admin/error");
    assert.equal(tokenEmitted, false);
  } finally {
    Object.assign(googleAuthContexts, originalMethods);
  }
});

test("readSecurity renvoie null : refus générique et contexte supprimé", async () => {
  const originalMethods = { ...googleAuthContexts };
  let deleteCalled = false;
  const fakeStore = createFakeGoogleAuthContextService();
  fakeStore.delete = async () => {
    deleteCalled = true;
  };
  Object.assign(googleAuthContexts, fakeStore);

  try {
    let tokenEmitted = false;
    const user = createValidSuperUser();
    const options = createAuthOptions({
      surface: "admin",
      isAuthAdminCentral: true,
      getCurrentUniversityId: async () => "legacy-univ",
      resolveGoogleUniversityId: SUPER_LOGIN_RESOLVER,
      getSuperAdminSecurityDetails: async () => null,
      resolveGoogleSuperExistingAccountUrl: async () => {
        tokenEmitted = true;
        return "/should-not-reach";
      },
      getUserByAccount: async () => null,
      getUserByEmail: async () => user,
    });

    const signIn = options.callbacks?.signIn;
    assert.ok(signIn);

    const result = await signIn({
      user: { id: "user-super-1", email: "editor@example.com" },
      account: { provider: "google", providerAccountId: "acc-google-nosec", type: "oauth" },
      profile: { email: "editor@example.com", email_verified: true },
    });

    assert.equal(result, "/auth-admin/error");
    assert.equal(tokenEmitted, false);
    assert.equal(deleteCalled, true);
  } finally {
    Object.assign(googleAuthContexts, originalMethods);
  }
});

test("readSecurity lève une erreur : refus générique et contexte supprimé", async () => {
  const originalMethods = { ...googleAuthContexts };
  let deleteCalled = false;
  const fakeStore = createFakeGoogleAuthContextService();
  fakeStore.delete = async () => {
    deleteCalled = true;
  };
  Object.assign(googleAuthContexts, fakeStore);

  try {
    let tokenEmitted = false;
    const user = createValidSuperUser();
    const options = createAuthOptions({
      surface: "admin",
      isAuthAdminCentral: true,
      getCurrentUniversityId: async () => "legacy-univ",
      resolveGoogleUniversityId: SUPER_LOGIN_RESOLVER,
      getSuperAdminSecurityDetails: async () => {
        throw new Error("DB connection failure");
      },
      resolveGoogleSuperExistingAccountUrl: async () => {
        tokenEmitted = true;
        return "/should-not-reach";
      },
      getUserByAccount: async () => null,
      getUserByEmail: async () => user,
    });

    const signIn = options.callbacks?.signIn;
    assert.ok(signIn);

    const result = await signIn({
      user: { id: "user-super-1", email: "editor@example.com" },
      account: { provider: "google", providerAccountId: "acc-google-err", type: "oauth" },
      profile: { email: "editor@example.com", email_verified: true },
    });

    assert.equal(result, "/auth-admin/error");
    assert.equal(tokenEmitted, false);
    assert.equal(deleteCalled, true);
  } finally {
    Object.assign(googleAuthContexts, originalMethods);
  }
});

test("revokedAt présent : refus avec toutes les autres valeurs valides", async () => {
  const originalMethods = { ...googleAuthContexts };
  Object.assign(googleAuthContexts, createFakeGoogleAuthContextService());

  try {
    let tokenEmitted = false;
    const user = createValidSuperUser();
    const options = createAuthOptions({
      surface: "admin",
      isAuthAdminCentral: true,
      getCurrentUniversityId: async () => "legacy-univ",
      resolveGoogleUniversityId: SUPER_LOGIN_RESOLVER,
      getSuperAdminSecurityDetails: async () => ({
        passwordHash: "$2a$12$validPasswordHashForEditorUser123",
        revokedAt: new Date("2026-03-01T00:00:00Z"),
      }),
      resolveGoogleSuperExistingAccountUrl: async () => {
        tokenEmitted = true;
        return "/should-not-reach";
      },
      getUserByAccount: async () => null,
      getUserByEmail: async () => user,
    });

    const signIn = options.callbacks?.signIn;
    assert.ok(signIn);

    const result = await signIn({
      user: { id: "user-super-revoked-explicit", email: "editor@example.com" },
      account: { provider: "google", providerAccountId: "acc-google-revoked-explicit", type: "oauth" },
      profile: { email: "editor@example.com", email_verified: true },
    });

    assert.equal(result, "/auth-admin/error");
    assert.equal(tokenEmitted, false);
  } finally {
    Object.assign(googleAuthContexts, originalMethods);
  }
});

test("getAdminInvitationContext ignore un objet { flow: 'super_login', transactionId }", async () => {
  const originalMethods = { ...googleAuthContexts };
  Object.assign(googleAuthContexts, createFakeGoogleAuthContextService());

  try {
    let invitationCheckCalled = false;
    const user = createValidSuperUser();
    const options = createAuthOptions({
      surface: "admin",
      isAuthAdminCentral: true,
      getCurrentUniversityId: async () => "legacy-univ",
      resolveGoogleUniversityId: SUPER_LOGIN_RESOLVER,
      checkAdminInvitationGoogleEligibility: async () => {
        invitationCheckCalled = true;
        return { ok: true, pendingUserId: null };
      },
      getSuperAdminSecurityDetails: async () => createValidSecurityDetails(),
      resolveGoogleSuperExistingAccountUrl: async (t) => `/login?googleExisting=${t}`,
      getUserByAccount: async () => null,
      getUserByEmail: async () => user,
    });

    const signIn = options.callbacks?.signIn;
    assert.ok(signIn);

    const result = await signIn({
      user: { id: "user-super-inv-ignore", email: "editor@example.com" },
      account: { provider: "google", providerAccountId: "acc-google-inv-ignore", type: "oauth" },
      profile: { email: "editor@example.com", email_verified: true },
    });

    assert.equal(invitationCheckCalled, false);
    assert.ok(typeof result === "string" && result.startsWith("/login?googleExisting="));
  } finally {
    Object.assign(googleAuthContexts, originalMethods);
  }
});

test("createUser refusé en contexte super_login", async () => {
  const options = createAuthOptions({
    surface: "admin",
    isAuthAdminCentral: true,
    getCurrentUniversityId: async () => "legacy-univ",
    resolveGoogleUniversityId: SUPER_LOGIN_RESOLVER,
    getUserByAccount: async () => null,
    getUserByEmail: async () => null,
  });

  const createUser = options.adapter?.createUser;
  assert.ok(createUser);

  await assert.rejects(
    createUser({
      name: "New Super",
      email: "newsuper@example.com",
      emailVerified: null,
      role: "super_admin_editor",
      universityId: null,
    }),
    /création de compte est interdite/i,
  );
});

test("linkAccount refusé en contexte super_login", async () => {
  const options = createAuthOptions({
    surface: "admin",
    isAuthAdminCentral: true,
    getCurrentUniversityId: async () => "legacy-univ",
    resolveGoogleUniversityId: SUPER_LOGIN_RESOLVER,
    getUserByAccount: async () => null,
    getUserByEmail: async () => null,
  });

  const linkAccount = options.adapter?.linkAccount;
  assert.ok(linkAccount);

  await assert.rejects(
    linkAccount({
      userId: "user-123",
      provider: "google",
      providerAccountId: "acc-google-link-refused",
      type: "oauth",
    }),
    /liaison de compte est interdite/i,
  );
});

test("jeton super émis seulement pour le cas accepté (jamais lors d'un refus)", async () => {
  const originalMethods = { ...googleAuthContexts };
  Object.assign(googleAuthContexts, createFakeGoogleAuthContextService());

  try {
    let callCount = 0;
    const urlResolver = async () => {
      callCount++;
      return "/url";
    };

    // Cas refus : chef
    const chefOptions = createAuthOptions({
      surface: "admin",
      isAuthAdminCentral: true,
      getCurrentUniversityId: async () => "legacy-univ",
      resolveGoogleUniversityId: SUPER_LOGIN_RESOLVER,
      getSuperAdminSecurityDetails: async () => createValidSecurityDetails(),
      resolveGoogleSuperExistingAccountUrl: urlResolver,
      getUserByAccount: async () => null,
      getUserByEmail: async () => createValidSuperUser({ role: "super_admin" }),
    });
    await chefOptions.callbacks?.signIn?.({
      user: { id: "u-1", email: "editor@example.com" },
      account: { provider: "google", providerAccountId: "acc-1", type: "oauth" },
      profile: { email: "editor@example.com", email_verified: true },
    });
    assert.equal(callCount, 0);

    // Cas refus : révoqué
    const revokedOptions = createAuthOptions({
      surface: "admin",
      isAuthAdminCentral: true,
      getCurrentUniversityId: async () => "legacy-univ",
      resolveGoogleUniversityId: SUPER_LOGIN_RESOLVER,
      getSuperAdminSecurityDetails: async () => createValidSecurityDetails({
        revokedAt: new Date(),
      }),
      resolveGoogleSuperExistingAccountUrl: urlResolver,
      getUserByAccount: async () => null,
      getUserByEmail: async () => createValidSuperUser(),
    });
    await revokedOptions.callbacks?.signIn?.({
      user: { id: "u-2", email: "editor@example.com" },
      account: { provider: "google", providerAccountId: "acc-2", type: "oauth" },
      profile: { email: "editor@example.com", email_verified: true },
    });
    assert.equal(callCount, 0);

    // Cas refus : non vérifié
    const unverifiedOptions = createAuthOptions({
      surface: "admin",
      isAuthAdminCentral: true,
      getCurrentUniversityId: async () => "legacy-univ",
      resolveGoogleUniversityId: SUPER_LOGIN_RESOLVER,
      getSuperAdminSecurityDetails: async () => createValidSecurityDetails(),
      resolveGoogleSuperExistingAccountUrl: urlResolver,
      getUserByAccount: async () => null,
      getUserByEmail: async () => createValidSuperUser({ emailVerified: null }),
    });
    await unverifiedOptions.callbacks?.signIn?.({
      user: { id: "u-3", email: "editor@example.com" },
      account: { provider: "google", providerAccountId: "acc-3", type: "oauth" },
      profile: { email: "editor@example.com", email_verified: true },
    });
    assert.equal(callCount, 0);

    // Cas refus : readSecurity renvoie null
    const nullSecOptions = createAuthOptions({
      surface: "admin",
      isAuthAdminCentral: true,
      getCurrentUniversityId: async () => "legacy-univ",
      resolveGoogleUniversityId: SUPER_LOGIN_RESOLVER,
      getSuperAdminSecurityDetails: async () => null,
      resolveGoogleSuperExistingAccountUrl: urlResolver,
      getUserByAccount: async () => null,
      getUserByEmail: async () => createValidSuperUser(),
    });
    await nullSecOptions.callbacks?.signIn?.({
      user: { id: "u-nullsec", email: "editor@example.com" },
      account: { provider: "google", providerAccountId: "acc-nullsec", type: "oauth" },
      profile: { email: "editor@example.com", email_verified: true },
    });
    assert.equal(callCount, 0);

    // Cas refus : readSecurity lève une erreur
    const errSecOptions = createAuthOptions({
      surface: "admin",
      isAuthAdminCentral: true,
      getCurrentUniversityId: async () => "legacy-univ",
      resolveGoogleUniversityId: SUPER_LOGIN_RESOLVER,
      getSuperAdminSecurityDetails: async () => {
        throw new Error("DB fail");
      },
      resolveGoogleSuperExistingAccountUrl: urlResolver,
      getUserByAccount: async () => null,
      getUserByEmail: async () => createValidSuperUser(),
    });
    await errSecOptions.callbacks?.signIn?.({
      user: { id: "u-errsec", email: "editor@example.com" },
      account: { provider: "google", providerAccountId: "acc-errsec", type: "oauth" },
      profile: { email: "editor@example.com", email_verified: true },
    });
    assert.equal(callCount, 0);

    // Cas accepté : editor actif
    const acceptedOptions = createAuthOptions({
      surface: "admin",
      isAuthAdminCentral: true,
      getCurrentUniversityId: async () => "legacy-univ",
      resolveGoogleUniversityId: SUPER_LOGIN_RESOLVER,
      getSuperAdminSecurityDetails: async () => createValidSecurityDetails(),
      resolveGoogleSuperExistingAccountUrl: urlResolver,
      getUserByAccount: async () => null,
      getUserByEmail: async () => createValidSuperUser(),
    });
    await acceptedOptions.callbacks?.signIn?.({
      user: { id: "u-4", email: "editor@example.com" },
      account: { provider: "google", providerAccountId: "acc-4", type: "oauth" },
      profile: { email: "editor@example.com", email_verified: true },
    });
    assert.equal(callCount, 1);
  } finally {
    Object.assign(googleAuthContexts, originalMethods);
  }
});

test("editor lié Google accepté : code créé, URL renvoyée", async () => {
  const originalMethods = { ...googleAuthContexts };
  Object.assign(googleAuthContexts, createFakeGoogleAuthContextService());

  try {
    const user = createValidSuperUser({
      id: "user-editor-linked",
      role: "super_admin_editor",
      email: "editor@example.com",
    });

    let eligibilityInput: unknown = null;
    let transferCodeInput: unknown = null;
    let resolvedCode: string | null = null;

    const options = createAuthOptions({
      surface: "admin",
      isAuthAdminCentral: true,
      getCurrentUniversityId: async () => "legacy-univ",
      resolveGoogleUniversityId: SUPER_LOGIN_RESOLVER,
      getSuperAdminSecurityDetails: async () => createValidSecurityDetails(),
      checkSuperLoginGoogleEligibility: async (input) => {
        eligibilityInput = input;
        return { ok: true, userId: user.id };
      },
      createSuperLoginTransferCode: async (input) => {
        transferCodeInput = input;
        return "transfer-code-editor-xyz";
      },
      resolveGoogleSuperTransferUrl: async (code) => {
        resolvedCode = code;
        return `/auth-admin/callback?code=${code}`;
      },
      getUserByAccount: async () => user,
      getUserByEmail: async () => user,
    });

    const signIn = options.callbacks?.signIn;
    assert.ok(signIn);

    const result = await signIn({
      user: { id: user.id, email: user.email },
      account: { provider: "google", providerAccountId: "acc-google-editor", type: "oauth" },
      profile: { email: user.email, email_verified: true },
    });

    assert.equal(result, "/auth-admin/callback?code=transfer-code-editor-xyz");
    assert.deepEqual(eligibilityInput, {
      transactionId: "tx-super-test-789",
      email: "editor@example.com",
      providerAccountId: "acc-google-editor",
    });
    assert.deepEqual(transferCodeInput, {
      transactionId: "tx-super-test-789",
      userId: "user-editor-linked",
    });
    assert.equal(resolvedCode, "transfer-code-editor-xyz");
  } finally {
    Object.assign(googleAuthContexts, originalMethods);
  }
});

test("lector lié Google accepté", async () => {
  const originalMethods = { ...googleAuthContexts };
  Object.assign(googleAuthContexts, createFakeGoogleAuthContextService());

  try {
    const user = createValidSuperUser({
      id: "user-lector-linked",
      role: "super_admin_lector",
      email: "lector@example.com",
    });

    let eligibilityInput: unknown = null;
    let transferCodeInput: unknown = null;
    let resolvedCode: string | null = null;

    const options = createAuthOptions({
      surface: "admin",
      isAuthAdminCentral: true,
      getCurrentUniversityId: async () => "legacy-univ",
      resolveGoogleUniversityId: SUPER_LOGIN_RESOLVER,
      getSuperAdminSecurityDetails: async () => createValidSecurityDetails(),
      checkSuperLoginGoogleEligibility: async (input) => {
        eligibilityInput = input;
        return { ok: true, userId: user.id };
      },
      createSuperLoginTransferCode: async (input) => {
        transferCodeInput = input;
        return "transfer-code-lector-xyz";
      },
      resolveGoogleSuperTransferUrl: async (code) => {
        resolvedCode = code;
        return `/auth-admin/callback?code=${code}`;
      },
      getUserByAccount: async () => user,
      getUserByEmail: async () => user,
    });

    const signIn = options.callbacks?.signIn;
    assert.ok(signIn);

    const result = await signIn({
      user: { id: user.id, email: user.email },
      account: { provider: "google", providerAccountId: "acc-google-lector", type: "oauth" },
      profile: { email: user.email, email_verified: true },
    });

    assert.equal(result, "/auth-admin/callback?code=transfer-code-lector-xyz");
    assert.deepEqual(eligibilityInput, {
      transactionId: "tx-super-test-789",
      email: "lector@example.com",
      providerAccountId: "acc-google-lector",
    });
    assert.deepEqual(transferCodeInput, {
      transactionId: "tx-super-test-789",
      userId: "user-lector-linked",
    });
    assert.equal(resolvedCode, "transfer-code-lector-xyz");
  } finally {
    Object.assign(googleAuthContexts, originalMethods);
  }
});

test("chef refusé, éligibilité et code NON appelés (espions)", async () => {
  const originalMethods = { ...googleAuthContexts };
  Object.assign(googleAuthContexts, createFakeGoogleAuthContextService());

  try {
    const user = createValidSuperUser({
      id: "user-super-chef",
      role: "super_admin",
      email: "chef@example.com",
    });

    let eligibilityCalls = 0;
    let transferCodeCalls = 0;

    const options = createAuthOptions({
      surface: "admin",
      isAuthAdminCentral: true,
      getCurrentUniversityId: async () => "legacy-univ",
      resolveGoogleUniversityId: SUPER_LOGIN_RESOLVER,
      getSuperAdminSecurityDetails: async () => createValidSecurityDetails(),
      checkSuperLoginGoogleEligibility: async () => {
        eligibilityCalls++;
        return { ok: true, userId: user.id };
      },
      createSuperLoginTransferCode: async () => {
        transferCodeCalls++;
        return "code-chef";
      },
      resolveGoogleSuperTransferUrl: async (c) => `/callback?code=${c}`,
      getUserByAccount: async () => user,
      getUserByEmail: async () => user,
    });

    const signIn = options.callbacks?.signIn;
    assert.ok(signIn);

    const result = await signIn({
      user: { id: user.id, email: user.email },
      account: { provider: "google", providerAccountId: "acc-google-chef", type: "oauth" },
      profile: { email: user.email, email_verified: true },
    });

    assert.equal(result, AUTH_ADMIN_GOOGLE_ERROR_PATH);
    assert.equal(eligibilityCalls, 0);
    assert.equal(transferCodeCalls, 0);
  } finally {
    Object.assign(googleAuthContexts, originalMethods);
  }
});

test("revokedAt présent : refusé, éligibilité non appelée", async () => {
  const originalMethods = { ...googleAuthContexts };
  Object.assign(googleAuthContexts, createFakeGoogleAuthContextService());

  try {
    const user = createValidSuperUser({
      id: "user-revoked",
      role: "super_admin_editor",
      email: "editor@example.com",
    });

    let eligibilityCalls = 0;
    let transferCodeCalls = 0;

    const options = createAuthOptions({
      surface: "admin",
      isAuthAdminCentral: true,
      getCurrentUniversityId: async () => "legacy-univ",
      resolveGoogleUniversityId: SUPER_LOGIN_RESOLVER,
      getSuperAdminSecurityDetails: async () => createValidSecurityDetails({
        revokedAt: new Date("2026-05-01T12:00:00Z"),
      }),
      checkSuperLoginGoogleEligibility: async () => {
        eligibilityCalls++;
        return { ok: true, userId: user.id };
      },
      createSuperLoginTransferCode: async () => {
        transferCodeCalls++;
        return "code-revoked";
      },
      resolveGoogleSuperTransferUrl: async (c) => `/callback?code=${c}`,
      getUserByAccount: async () => user,
      getUserByEmail: async () => user,
    });

    const signIn = options.callbacks?.signIn;
    assert.ok(signIn);

    const result = await signIn({
      user: { id: user.id, email: user.email },
      account: { provider: "google", providerAccountId: "acc-google-revoked", type: "oauth" },
      profile: { email: user.email, email_verified: true },
    });

    assert.equal(result, AUTH_ADMIN_GOOGLE_ERROR_PATH);
    assert.equal(eligibilityCalls, 0);
    assert.equal(transferCodeCalls, 0);
  } finally {
    Object.assign(googleAuthContexts, originalMethods);
  }
});

test("éligibilité renvoie ok faux : refus", async () => {
  const originalMethods = { ...googleAuthContexts };
  Object.assign(googleAuthContexts, createFakeGoogleAuthContextService());

  try {
    const user = createValidSuperUser({
      id: "user-editor-not-eligible",
      role: "super_admin_editor",
      email: "editor@example.com",
    });

    let transferCodeCalls = 0;

    const options = createAuthOptions({
      surface: "admin",
      isAuthAdminCentral: true,
      getCurrentUniversityId: async () => "legacy-univ",
      resolveGoogleUniversityId: SUPER_LOGIN_RESOLVER,
      getSuperAdminSecurityDetails: async () => createValidSecurityDetails(),
      checkSuperLoginGoogleEligibility: async () => ({ ok: false, userId: null }),
      createSuperLoginTransferCode: async () => {
        transferCodeCalls++;
        return "code-should-not-exist";
      },
      resolveGoogleSuperTransferUrl: async (c) => `/callback?code=${c}`,
      getUserByAccount: async () => user,
      getUserByEmail: async () => user,
    });

    const signIn = options.callbacks?.signIn;
    assert.ok(signIn);

    const result = await signIn({
      user: { id: user.id, email: user.email },
      account: { provider: "google", providerAccountId: "acc-google-not-eligible", type: "oauth" },
      profile: { email: user.email, email_verified: true },
    });

    assert.equal(result, AUTH_ADMIN_GOOGLE_ERROR_PATH);
    assert.equal(transferCodeCalls, 0);
  } finally {
    Object.assign(googleAuthContexts, originalMethods);
  }
});

test("éligibilité lève : refus", async () => {
  const originalMethods = { ...googleAuthContexts };
  Object.assign(googleAuthContexts, createFakeGoogleAuthContextService());

  try {
    const user = createValidSuperUser({
      id: "user-editor-throws",
      role: "super_admin_editor",
      email: "editor@example.com",
    });

    let transferCodeCalls = 0;

    const options = createAuthOptions({
      surface: "admin",
      isAuthAdminCentral: true,
      getCurrentUniversityId: async () => "legacy-univ",
      resolveGoogleUniversityId: SUPER_LOGIN_RESOLVER,
      getSuperAdminSecurityDetails: async () => createValidSecurityDetails(),
      checkSuperLoginGoogleEligibility: async () => {
        throw new Error("DB connection failure in eligibility");
      },
      createSuperLoginTransferCode: async () => {
        transferCodeCalls++;
        return "code-should-not-exist";
      },
      resolveGoogleSuperTransferUrl: async (c) => `/callback?code=${c}`,
      getUserByAccount: async () => user,
      getUserByEmail: async () => user,
    });

    const signIn = options.callbacks?.signIn;
    assert.ok(signIn);

    const result = await signIn({
      user: { id: user.id, email: user.email },
      account: { provider: "google", providerAccountId: "acc-google-throws", type: "oauth" },
      profile: { email: user.email, email_verified: true },
    });

    assert.equal(result, AUTH_ADMIN_GOOGLE_ERROR_PATH);
    assert.equal(transferCodeCalls, 0);
  } finally {
    Object.assign(googleAuthContexts, originalMethods);
  }
});

test("création du code renvoie faux : refus", async () => {
  const originalMethods = { ...googleAuthContexts };
  Object.assign(googleAuthContexts, createFakeGoogleAuthContextService());

  try {
    const user = createValidSuperUser({
      id: "user-editor-code-null",
      role: "super_admin_editor",
      email: "editor@example.com",
    });

    let resolverCalls = 0;

    const options = createAuthOptions({
      surface: "admin",
      isAuthAdminCentral: true,
      getCurrentUniversityId: async () => "legacy-univ",
      resolveGoogleUniversityId: SUPER_LOGIN_RESOLVER,
      getSuperAdminSecurityDetails: async () => createValidSecurityDetails(),
      checkSuperLoginGoogleEligibility: async () => ({ ok: true, userId: user.id }),
      createSuperLoginTransferCode: async () => null,
      resolveGoogleSuperTransferUrl: async (c) => {
        resolverCalls++;
        return `/callback?code=${c}`;
      },
      getUserByAccount: async () => user,
      getUserByEmail: async () => user,
    });

    const signIn = options.callbacks?.signIn;
    assert.ok(signIn);

    const result = await signIn({
      user: { id: user.id, email: user.email },
      account: { provider: "google", providerAccountId: "acc-google-code-null", type: "oauth" },
      profile: { email: user.email, email_verified: true },
    });

    assert.equal(result, AUTH_ADMIN_GOOGLE_ERROR_PATH);
    assert.equal(resolverCalls, 0);
  } finally {
    Object.assign(googleAuthContexts, originalMethods);
  }
});

test("création du code lève : refus", async () => {
  const originalMethods = { ...googleAuthContexts };
  Object.assign(googleAuthContexts, createFakeGoogleAuthContextService());

  try {
    const user = createValidSuperUser({
      id: "user-editor-code-throw",
      role: "super_admin_editor",
      email: "editor@example.com",
    });

    let resolverCalls = 0;

    const options = createAuthOptions({
      surface: "admin",
      isAuthAdminCentral: true,
      getCurrentUniversityId: async () => "legacy-univ",
      resolveGoogleUniversityId: SUPER_LOGIN_RESOLVER,
      getSuperAdminSecurityDetails: async () => createValidSecurityDetails(),
      checkSuperLoginGoogleEligibility: async () => ({ ok: true, userId: user.id }),
      createSuperLoginTransferCode: async () => {
        throw new Error("DB failure during transfer code creation");
      },
      resolveGoogleSuperTransferUrl: async (c) => {
        resolverCalls++;
        return `/callback?code=${c}`;
      },
      getUserByAccount: async () => user,
      getUserByEmail: async () => user,
    });

    const signIn = options.callbacks?.signIn;
    assert.ok(signIn);

    const result = await signIn({
      user: { id: user.id, email: user.email },
      account: { provider: "google", providerAccountId: "acc-google-code-throw", type: "oauth" },
      profile: { email: user.email, email_verified: true },
    });

    assert.equal(result, AUTH_ADMIN_GOOGLE_ERROR_PATH);
    assert.equal(resolverCalls, 0);
  } finally {
    Object.assign(googleAuthContexts, originalMethods);
  }
});

test("resolveGoogleSuperTransferUrl absent ou null : refus", async () => {
  const originalMethods = { ...googleAuthContexts };
  Object.assign(googleAuthContexts, createFakeGoogleAuthContextService());

  try {
    const user = createValidSuperUser({
      id: "user-editor-no-url",
      role: "super_admin_editor",
      email: "editor@example.com",
    });

    // Cas absent
    const optionsAbsent = createAuthOptions({
      surface: "admin",
      isAuthAdminCentral: true,
      getCurrentUniversityId: async () => "legacy-univ",
      resolveGoogleUniversityId: SUPER_LOGIN_RESOLVER,
      getSuperAdminSecurityDetails: async () => createValidSecurityDetails(),
      checkSuperLoginGoogleEligibility: async () => ({ ok: true, userId: user.id }),
      createSuperLoginTransferCode: async () => "valid-code-absent",
      getUserByAccount: async () => user,
      getUserByEmail: async () => user,
    });

    const signInAbsent = optionsAbsent.callbacks?.signIn;
    assert.ok(signInAbsent);

    const resultAbsent = await signInAbsent({
      user: { id: user.id, email: user.email },
      account: { provider: "google", providerAccountId: "acc-google-absent", type: "oauth" },
      profile: { email: user.email, email_verified: true },
    });
    assert.equal(resultAbsent, AUTH_ADMIN_GOOGLE_ERROR_PATH);

    // Cas renvoie null
    const optionsNull = createAuthOptions({
      surface: "admin",
      isAuthAdminCentral: true,
      getCurrentUniversityId: async () => "legacy-univ",
      resolveGoogleUniversityId: SUPER_LOGIN_RESOLVER,
      getSuperAdminSecurityDetails: async () => createValidSecurityDetails(),
      checkSuperLoginGoogleEligibility: async () => ({ ok: true, userId: user.id }),
      createSuperLoginTransferCode: async () => "valid-code-null",
      resolveGoogleSuperTransferUrl: async () => null,
      getUserByAccount: async () => user,
      getUserByEmail: async () => user,
    });

    const signInNull = optionsNull.callbacks?.signIn;
    assert.ok(signInNull);

    const resultNull = await signInNull({
      user: { id: user.id, email: user.email },
      account: { provider: "google", providerAccountId: "acc-google-null", type: "oauth" },
      profile: { email: user.email, email_verified: true },
    });
    assert.equal(resultNull, AUTH_ADMIN_GOOGLE_ERROR_PATH);
  } finally {
    Object.assign(googleAuthContexts, originalMethods);
  }
});

test("compte à mot de passe seul : jeton googleExisting comme avant, éligibilité non appelée", async () => {
  const originalMethods = { ...googleAuthContexts };
  Object.assign(googleAuthContexts, createFakeGoogleAuthContextService());

  try {
    const user = createValidSuperUser({
      id: "user-password-only",
      role: "super_admin_editor",
      email: "passwordonly@example.com",
    });

    let eligibilityCalls = 0;
    let transferCodeCalls = 0;
    let existingToken: string | null = null;

    const options = createAuthOptions({
      surface: "admin",
      isAuthAdminCentral: true,
      getCurrentUniversityId: async () => "legacy-univ",
      resolveGoogleUniversityId: SUPER_LOGIN_RESOLVER,
      getSuperAdminSecurityDetails: async () => createValidSecurityDetails(),
      checkSuperLoginGoogleEligibility: async () => {
        eligibilityCalls++;
        return { ok: true, userId: user.id };
      },
      createSuperLoginTransferCode: async () => {
        transferCodeCalls++;
        return "transfer-code";
      },
      resolveGoogleSuperExistingAccountUrl: async (token) => {
        existingToken = token;
        return `/login?googleExisting=${token}`;
      },
      getUserByAccount: async () => null, // Pas de compte Google lié
      getUserByEmail: async () => user,
    });

    const signIn = options.callbacks?.signIn;
    assert.ok(signIn);

    const result = await signIn({
      user: { id: user.id, email: user.email },
      account: { provider: "google", providerAccountId: "acc-google-password-only", type: "oauth" },
      profile: { email: user.email, email_verified: true },
    });

    assert.equal(typeof result, "string");
    assert.ok((result as string).startsWith("/login?googleExisting="));
    assert.ok(existingToken !== null);
    assert.equal(eligibilityCalls, 0);
    assert.equal(transferCodeCalls, 0);

    const verified = verifySuperGoogleExistingAccountToken(existingToken!, { secret: SECRET });
    assert.deepEqual(verified, { email: "passwordonly@example.com" });
  } finally {
    Object.assign(googleAuthContexts, originalMethods);
  }
});

test("deleteGoogleAuthContext lève : refus générique quand même", async () => {
  const originalMethods = { ...googleAuthContexts };
  const fakeStore = createFakeGoogleAuthContextService();
  fakeStore.delete = async () => {
    throw new Error("Store delete failure");
  };
  Object.assign(googleAuthContexts, fakeStore);

  try {
    const user = createValidSuperUser({
      id: "user-delete-throws",
      role: "super_admin_editor",
      email: "editor@example.com",
    });

    const options = createAuthOptions({
      surface: "admin",
      isAuthAdminCentral: true,
      getCurrentUniversityId: async () => "legacy-univ",
      resolveGoogleUniversityId: SUPER_LOGIN_RESOLVER,
      getSuperAdminSecurityDetails: async () => createValidSecurityDetails(),
      checkSuperLoginGoogleEligibility: async () => ({ ok: false, userId: null }),
      getUserByAccount: async () => user,
      getUserByEmail: async () => user,
    });

    const signIn = options.callbacks?.signIn;
    assert.ok(signIn);

    const result = await signIn({
      user: { id: user.id, email: user.email },
      account: { provider: "google", providerAccountId: "acc-delete-throws", type: "oauth" },
      profile: { email: user.email, email_verified: true },
    });

    assert.equal(result, AUTH_ADMIN_GOOGLE_ERROR_PATH);
  } finally {
    Object.assign(googleAuthContexts, originalMethods);
  }
});

test("test sans injection : le repli réel est référencé (preuve par lecture de code, pas par appel base)", () => {
  const indexPath = typeof import.meta !== "undefined" && import.meta.url
    ? new URL("../src/index.ts", import.meta.url)
    : path.resolve(__dirname, "../src/index.ts");
  const indexSource = fs.readFileSync(indexPath, "utf8");

  // Preuve que les fonctions sont importées depuis @tablino/db
  assert.ok(
    indexSource.includes("checkAdminSuperLoginGoogleEligibility"),
    "checkAdminSuperLoginGoogleEligibility doit être importé dans src/index.ts",
  );
  assert.ok(
    indexSource.includes("createAdminSuperLoginOauthTransferCode"),
    "createAdminSuperLoginOauthTransferCode doit être importé dans src/index.ts",
  );

  // Preuve que les replis sont référencés dans signIn sans injection
  assert.ok(
    indexSource.includes("context.checkSuperLoginGoogleEligibility ?? checkAdminSuperLoginGoogleEligibility"),
    "Le repli checkAdminSuperLoginGoogleEligibility doit être référencé",
  );
  assert.ok(
    indexSource.includes("context.createSuperLoginTransferCode ?? createAdminSuperLoginOauthTransferCode"),
    "Le repli createAdminSuperLoginOauthTransferCode doit être référencé",
  );

  // Preuve que les fonctions importées de @tablino/db sont bien des fonctions
  assert.equal(typeof checkAdminSuperLoginGoogleEligibility, "function");
  assert.equal(typeof createAdminSuperLoginOauthTransferCode, "function");
});
