import assert from "node:assert/strict";
import test from "node:test";
import { getAvatarInitial, getRoleLabel } from "../src/lib/admin-profile.mjs";

test("uses the uppercase first character of name, then email, then question mark", () => {
  assert.equal(getAvatarInitial("  alice Example  ", "alice@example.invalid"), "A");
  assert.equal(getAvatarInitial("   ", "  alice@example.invalid  "), "A");
  assert.equal(getAvatarInitial(null, ""), "?");
  assert.equal(getAvatarInitial(undefined, undefined), "?");
});

test("maps known roles and falls back to the administrator label", () => {
  assert.equal(getRoleLabel("super_admin"), "Super administrateur");
  assert.equal(getRoleLabel("university_admin"), "Administrateur d'université");
  assert.equal(getRoleLabel("student"), "Administrateur");
  assert.equal(getRoleLabel("unknown"), "Administrateur");
});
