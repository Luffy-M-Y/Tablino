import assert from "node:assert/strict";
import test from "node:test";
import {
  AuthorizationDeniedError,
  createAuthGuards,
  SessionRequiredError,
  type GuardUser,
} from "../src/guards";

const student = { id: "user-1", role: "student" as const, universityId: "university-a" };
const universityAdmin = {
  id: "user-2",
  role: "university_admin" as const,
  universityId: "university-a",
};
const superAdmin = { id: "user-3", role: "super_admin" as const, universityId: null };

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

test("a super admin is accepted for any university on both surfaces", async () => {
  const { guards } = harness(superAdmin);
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
