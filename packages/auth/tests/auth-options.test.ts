import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTH_ADMIN_GOOGLE_EXISTING_ACCOUNT,
  AUTH_ADMIN_GOOGLE_ERROR_PATH,
  decideAdminGoogleSignIn,
  isAdminCentralGoogleLinkAllowed,
  shouldMarkGoogleEmailVerified,
} from "../src/admin-google-signin";
import { createAuthOptions } from "../src/index";

test("createAuthOptions configures the admin sign-in page only for the admin surface", () => {
  const getCurrentUniversityId = async () => "university-id";
  const adminOptions = createAuthOptions({ surface: "admin", getCurrentUniversityId });
  const centralAdminOptions = createAuthOptions({
    surface: "admin",
    getCurrentUniversityId,
    isAuthAdminCentral: true,
  });
  const webOptions = createAuthOptions({ surface: "web", getCurrentUniversityId });

  assert.equal(adminOptions.pages?.signIn, "/login");
  assert.equal(adminOptions.pages?.error, undefined);
  assert.equal(centralAdminOptions.pages?.signIn, "/login");
  assert.equal(centralAdminOptions.pages?.error, AUTH_ADMIN_GOOGLE_ERROR_PATH);
  assert.equal(webOptions.pages, undefined);
});

test("central admin Google sign-in rejects unknown users and non-university-admin roles", () => {
  const base = {
    isAuthAdminCentral: true,
    googleUniversityId: "university-a",
  };

  assert.equal(decideAdminGoogleSignIn({ ...base, user: null }), AUTH_ADMIN_GOOGLE_ERROR_PATH);
  assert.equal(
    decideAdminGoogleSignIn({
      ...base,
      user: { role: "student", universityId: "university-a" },
    }),
    AUTH_ADMIN_GOOGLE_ERROR_PATH,
  );
  assert.equal(
    decideAdminGoogleSignIn({
      ...base,
      user: { role: "super_admin", universityId: null },
    }),
    AUTH_ADMIN_GOOGLE_ERROR_PATH,
  );
});

test("central admin Google sign-in requires the matching university_admin tenant", () => {
  const base = {
    isAuthAdminCentral: true,
    googleUniversityId: "university-a",
  };

  assert.equal(
    decideAdminGoogleSignIn({
      ...base,
      user: { role: "university_admin", universityId: "university-a" },
      hasGoogleAccountLinked: true,
    }),
    true,
  );
  assert.equal(
    decideAdminGoogleSignIn({
      ...base,
      user: { role: "university_admin", universityId: "university-a" },
      hasGoogleAccountLinked: false,
    }),
    AUTH_ADMIN_GOOGLE_EXISTING_ACCOUNT,
  );
  assert.equal(
    decideAdminGoogleSignIn({
      ...base,
      user: { role: "university_admin", universityId: "university-b" },
    }),
    AUTH_ADMIN_GOOGLE_ERROR_PATH,
  );
  assert.equal(
    decideAdminGoogleSignIn({
      ...base,
      user: { role: "university_admin", universityId: null },
    }),
    AUTH_ADMIN_GOOGLE_ERROR_PATH,
  );
});

test("central admin Google sign-in never accepts an unlinked, cross-university, or wrong-role account", () => {
  const base = {
    isAuthAdminCentral: true,
    googleUniversityId: "university-a",
    hasGoogleAccountLinked: false,
  };

  assert.notEqual(
    decideAdminGoogleSignIn({
      ...base,
      user: { role: "university_admin", universityId: "university-a" },
    }),
    true,
  );
  assert.equal(
    decideAdminGoogleSignIn({
      ...base,
      user: { role: "university_admin", universityId: "university-b" },
    }),
    AUTH_ADMIN_GOOGLE_ERROR_PATH,
  );
  assert.equal(
    decideAdminGoogleSignIn({
      ...base,
      user: { role: "student", universityId: "university-a" },
    }),
    AUTH_ADMIN_GOOGLE_ERROR_PATH,
  );
});

test("central admin adapter cannot link Google accounts and admin links never trigger password removal", () => {
  assert.equal(isAdminCentralGoogleLinkAllowed(true), false);
  assert.equal(isAdminCentralGoogleLinkAllowed(false), true);
  assert.equal(shouldMarkGoogleEmailVerified("admin"), false);
  assert.equal(shouldMarkGoogleEmailVerified("web"), true);
});

test("non-central admin Google sign-in keeps its existing role and scope decisions", () => {
  const base = {
    isAuthAdminCentral: false,
    googleUniversityId: "university-a",
  };

  assert.equal(
    decideAdminGoogleSignIn({
      ...base,
      user: { role: "super_admin", universityId: null },
    }),
    true,
  );
  assert.equal(
    decideAdminGoogleSignIn({
      ...base,
      user: { role: "university_admin", universityId: "another-university" },
    }),
    true,
  );
  assert.equal(
    decideAdminGoogleSignIn({
      ...base,
      user: { role: "student", universityId: "university-a" },
    }),
    false,
  );
  assert.equal(decideAdminGoogleSignIn({ ...base, user: null }), null);
});
