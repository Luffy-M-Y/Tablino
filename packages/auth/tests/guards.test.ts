import assert from "node:assert/strict";
import test from "node:test";
import {
  AuthorizationDeniedError,
  createAuthGuards,
  SessionRequiredError,
  type GuardUser,
} from "../src/guards";

const student = {
  id: "user-1",
  role: "student" as const,
  universityId: "university-a",
  universityStatus: "active" as const,
  revokedAt: null,
  trialEndsAt: null,
  subscriptionExpiresAt: null,
  currentPlan: null,
};
const universityAdmin = {
  id: "user-2",
  role: "university_admin" as const,
  universityId: "university-a",
  universityStatus: "active" as const,
  revokedAt: null,
  trialEndsAt: null,
  subscriptionExpiresAt: null,
  currentPlan: null,
};
const superAdmin = {
  id: "user-3",
  role: "super_admin" as const,
  universityId: null,
  universityStatus: null,
  revokedAt: null,
  trialEndsAt: null,
  subscriptionExpiresAt: null,
  currentPlan: null,
};

function harness(initialUser: GuardUser | null) {
  let currentUser = initialUser;
  let activeSession = initialUser !== null;
  const guards = createAuthGuards({
    async readSession() {
      return activeSession && currentUser ? { user: { id: currentUser.id } } : null;
    },
    async readUser(userId) {
      return currentUser?.id === userId ? currentUser : null;
    },
  });
  return {
    guards,
    setUser(user: GuardUser | null) { currentUser = user; },
    expireSession() { activeSession = false; },
  };
}

test("an anonymous request is denied", async () => {
  const { guards } = harness(null);
  await assert.rejects(guards.requireSession("web"), SessionRequiredError);
});

test("a student is denied on the admin surface", async () => {
  const { guards } = harness(student);
  await assert.rejects(
    guards.requireRole("admin", ["super_admin", "university_admin"]),
    AuthorizationDeniedError,
  );
});

test("a university admin is denied access to another university", async () => {
  const { guards } = harness(universityAdmin);
  assert.equal(
    (await guards.requireUniversityAccess("admin", "university-a")).id,
    universityAdmin.id,
  );
  await assert.rejects(
    guards.requireUniversityAccess("admin", "university-b"),
    AuthorizationDeniedError,
  );
});

test("a pending university admin is denied by requireRole", async () => {
  const { guards } = harness({ ...universityAdmin, universityStatus: "pending" });

  await assert.rejects(
    guards.requireRole("admin", ["university_admin"]),
    AuthorizationDeniedError,
  );
});

test("a pending university admin is denied by requireUniversityAccess", async () => {
  const { guards } = harness({ ...universityAdmin, universityStatus: "pending" });

  await assert.rejects(
    guards.requireUniversityAccess("admin", "university-a"),
    AuthorizationDeniedError,
  );
});

test("an active university admin is accepted by both guards", async () => {
  const { guards } = harness(universityAdmin);

  assert.equal((await guards.requireRole("admin", ["university_admin"])).id, universityAdmin.id);
  assert.equal(
    (await guards.requireUniversityAccess("admin", "university-a")).id,
    universityAdmin.id,
  );
});

test("a super admin is accepted for any university on both surfaces", async () => {
  const { guards } = harness(superAdmin);
  assert.equal((await guards.requireRole("admin", ["super_admin"])).id, superAdmin.id);
  assert.equal((await guards.requireUniversityAccess("admin", "university-b")).id, superAdmin.id);
  assert.equal((await guards.requireUniversityAccess("web", "university-b")).id, superAdmin.id);
});

test("an expired session is denied", async () => {
  const { guards, expireSession } = harness(student);
  expireSession();
  await assert.rejects(guards.requireSession("web"), SessionRequiredError);
});

test("a role changed in the database is applied on the next request", async () => {
  const { guards, setUser } = harness(universityAdmin);
  await guards.requireRole("admin", ["university_admin"]);
  setUser({ ...universityAdmin, role: "student" });
  await assert.rejects(
    guards.requireRole("admin", ["university_admin"]),
    AuthorizationDeniedError,
  );
});
