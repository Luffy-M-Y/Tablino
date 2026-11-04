import assert from "node:assert/strict";
import test from "node:test";
import { createAuthOptions } from "../src/index";

test("createAuthOptions configures the admin sign-in page only for the admin surface", () => {
  const getCurrentUniversityId = async () => "university-id";
  const adminOptions = createAuthOptions({ surface: "admin", getCurrentUniversityId });
  const webOptions = createAuthOptions({ surface: "web", getCurrentUniversityId });

  assert.equal(adminOptions.pages?.signIn, "/login");
  assert.equal(webOptions.pages, undefined);
});
