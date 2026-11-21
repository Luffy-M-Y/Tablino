import assert from "node:assert/strict";
import test from "node:test";
import { createAuthOptions } from "../src/index";
import { googleAuthContexts } from "../src/google-auth-context";

const INVITATION_CONTEXT = {
  invitationId: "inv-test-123",
  transactionId: "tx-test-456",
};

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

test("signIn callback: rejects invitation when checkAdminInvitationGoogleEligibility returns false (email mismatch)", async () => {
  const originalMethods = {
    record: googleAuthContexts.record,
    consume: googleAuthContexts.consume,
    delete: googleAuthContexts.delete,
  };
  Object.assign(googleAuthContexts, createFakeGoogleAuthContextService());

  try {
    let checkedEmail = "";
    const options = createAuthOptions({
      surface: "admin",
      isAuthAdminCentral: true,
      getCurrentUniversityId: async () => "univ-1",
      resolveAdminInvitationOauthContext: async () => INVITATION_CONTEXT,
      checkAdminInvitationGoogleEligibility: async ({ email }) => {
        checkedEmail = String(email);
        return { ok: false, pendingUserId: null };
      },
      getUserByAccount: async () => null,
      getUserByEmail: async () => null,
    });

    const signIn = options.callbacks?.signIn;
    assert.ok(signIn);

    const result = await signIn({
      user: { id: "u-1", email: "wrong-email@example.com" },
      account: { provider: "google", providerAccountId: "acc-google-1", type: "oauth" },
      profile: { email: "wrong-email@example.com", email_verified: true },
    });

    assert.equal(checkedEmail, "wrong-email@example.com");
    assert.equal(result, false);
  } finally {
    Object.assign(googleAuthContexts, originalMethods);
  }
});

test("signIn callback: rejects invitation when user role is super_admin", async () => {
  const originalMethods = {
    record: googleAuthContexts.record,
    consume: googleAuthContexts.consume,
    delete: googleAuthContexts.delete,
  };
  Object.assign(googleAuthContexts, createFakeGoogleAuthContextService());

  try {
    const options = createAuthOptions({
      surface: "admin",
      isAuthAdminCentral: true,
      getCurrentUniversityId: async () => "univ-1",
      resolveAdminInvitationOauthContext: async () => INVITATION_CONTEXT,
      checkAdminInvitationGoogleEligibility: async () => ({ ok: true, pendingUserId: null }),
      getUserByAccount: async () => null,
      getUserByEmail: async () => ({
        id: "super-admin-user",
        name: "Chef",
        email: "invited@example.com",
        emailVerified: new Date(),
        image: null,
        role: "super_admin",
        universityId: null,
      }),
    });

    const signIn = options.callbacks?.signIn;
    assert.ok(signIn);

    const result = await signIn({
      user: { id: "u-1", email: "invited@example.com" },
      account: { provider: "google", providerAccountId: "acc-google-1", type: "oauth" },
      profile: { email: "invited@example.com", email_verified: true },
    });

    assert.equal(result, false);
  } finally {
    Object.assign(googleAuthContexts, originalMethods);
  }
});

test("signIn callback: rejects invitation when an unlinked existing user is found (no automatic linking)", async () => {
  const originalMethods = {
    record: googleAuthContexts.record,
    consume: googleAuthContexts.consume,
    delete: googleAuthContexts.delete,
  };
  Object.assign(googleAuthContexts, createFakeGoogleAuthContextService());

  try {
    const options = createAuthOptions({
      surface: "admin",
      isAuthAdminCentral: true,
      getCurrentUniversityId: async () => "univ-1",
      resolveAdminInvitationOauthContext: async () => INVITATION_CONTEXT,
      checkAdminInvitationGoogleEligibility: async () => ({ ok: true, pendingUserId: "pending-user-id" }),
      getUserByAccount: async () => null,
      getUserByEmail: async () => ({
        id: "other-existing-user-id",
        name: "Existing",
        email: "invited@example.com",
        emailVerified: new Date(),
        image: null,
        role: "super_admin_editor",
        universityId: null,
      }),
    });

    const signIn = options.callbacks?.signIn;
    assert.ok(signIn);

    const result = await signIn({
      user: { id: "u-1", email: "invited@example.com" },
      account: { provider: "google", providerAccountId: "acc-google-1", type: "oauth" },
      profile: { email: "invited@example.com", email_verified: true },
    });

    assert.equal(result, false);
  } finally {
    Object.assign(googleAuthContexts, originalMethods);
  }
});

test("signIn callback: accepts valid invitation for super_admin_editor and super_admin_lector", async () => {
  const originalMethods = {
    record: googleAuthContexts.record,
    consume: googleAuthContexts.consume,
    delete: googleAuthContexts.delete,
  };
  Object.assign(googleAuthContexts, createFakeGoogleAuthContextService());

  try {
    const options = createAuthOptions({
      surface: "admin",
      isAuthAdminCentral: true,
      getCurrentUniversityId: async () => "univ-1",
      resolveAdminInvitationOauthContext: async () => INVITATION_CONTEXT,
      checkAdminInvitationGoogleEligibility: async () => ({ ok: true, pendingUserId: null }),
      getUserByAccount: async () => null,
      getUserByEmail: async () => null,
    });

    const signIn = options.callbacks?.signIn;
    assert.ok(signIn);

    const result = await signIn({
      user: { id: "u-1", email: "editor@example.com" },
      account: { provider: "google", providerAccountId: "acc-google-editor", type: "oauth" },
      profile: { email: "editor@example.com", email_verified: true },
    });

    assert.equal(result, true);
  } finally {
    Object.assign(googleAuthContexts, originalMethods);
  }
});

test("createUser callback: creates pending user with role and null universityId for invitation", async () => {
  let createdInput: any = null;
  const options = createAuthOptions({
    surface: "admin",
    isAuthAdminCentral: true,
    getCurrentUniversityId: async () => "univ-1",
    resolveAdminInvitationOauthContext: async () => INVITATION_CONTEXT,
    createPendingAdminInvitationGoogleUser: async (input) => {
      createdInput = input;
      return "new-created-user-id";
    },
    getUserById: async (id) => ({
      id,
      name: "Invited Lector",
      email: "lector@example.com",
      emailVerified: null,
      image: null,
      role: "super_admin_lector",
      universityId: null,
    }),
  });

  const createUser = options.adapter?.createUser;
  assert.ok(createUser);

  const user = await createUser({
    name: "Invited Lector",
    email: "lector@example.com",
    emailVerified: null,
    image: null,
  });

  assert.deepEqual(createdInput, {
    invitationId: INVITATION_CONTEXT.invitationId,
    transactionId: INVITATION_CONTEXT.transactionId,
    email: "lector@example.com",
    name: "Invited Lector",
    image: null,
  });
  assert.equal(user.id, "new-created-user-id");
  assert.equal(user.email, "lector@example.com");
  assert.equal(user.role, "super_admin_lector");
  assert.equal(user.universityId, null);
});

test("createUser callback: throws for non-invitation Google flow (non-régression)", async () => {
  const options = createAuthOptions({
    surface: "admin",
    isAuthAdminCentral: true,
    getCurrentUniversityId: async () => "univ-1",
  });

  const createUser = options.adapter?.createUser;
  assert.ok(createUser);

  await assert.rejects(
    createUser({
      name: "Student",
      email: "student@example.com",
      emailVerified: null,
      image: null,
    }),
    /La création de compte par Google exige un code d'accès/,
  );
});

test("linkAccount callback: calls completeAdminInvitationGoogleAccount and links account", async () => {
  const originalMethods = {
    record: googleAuthContexts.record,
    consume: googleAuthContexts.consume,
    delete: googleAuthContexts.delete,
  };
  const store = createFakeGoogleAuthContextService();
  Object.assign(googleAuthContexts, store);

  try {
    let completedInput: any = null;
    const options = createAuthOptions({
      surface: "admin",
      isAuthAdminCentral: true,
      getCurrentUniversityId: async () => "univ-1",
      resolveAdminInvitationOauthContext: async () => INVITATION_CONTEXT,
      completeAdminInvitationGoogleAccount: async (input) => {
        completedInput = input;
        return true;
      },
    });

    const linkAccount = options.adapter?.linkAccount;
    assert.ok(linkAccount);

    // Enregistrer le contexte dans le store
    await store.record({
      providerAccountId: "google-acc-123",
      surface: "admin",
      email: "editor@example.com",
      universityId: null,
      now: Date.now(),
    });

    const account = {
      userId: "pending-editor-id",
      type: "oauth" as const,
      provider: "google",
      providerAccountId: "google-acc-123",
    };

    const linked = await linkAccount(account);
    assert.deepEqual(linked, account);
    assert.deepEqual(completedInput, {
      invitationId: INVITATION_CONTEXT.invitationId,
      transactionId: INVITATION_CONTEXT.transactionId,
      userId: "pending-editor-id",
      provider: "google",
      providerAccountId: "google-acc-123",
    });
  } finally {
    Object.assign(googleAuthContexts, originalMethods);
  }
});
