import assert from "node:assert/strict";
import test from "node:test";
import {
  hashPassword,
  isPasswordValid,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  verifyPassword,
} from "../src/password";

test("hashPassword creates a scrypt value that verifies", () => {
  const stored = hashPassword("correct horse battery staple");

  assert.equal(stored.split("$").length, 3);
  assert.equal(stored.startsWith("scrypt$"), true);
  assert.equal(verifyPassword("correct horse battery staple", stored), true);
});

test("verifyPassword rejects a wrong password", () => {
  assert.equal(verifyPassword("wrong password", hashPassword("correct password")), false);
});

test("hashPassword uses a different salt for each hash", () => {
  assert.notEqual(hashPassword("same password"), hashPassword("same password"));
});

test("verifyPassword rejects malformed stored values without throwing", () => {
  for (const stored of ["", "scrypt$only-two-parts", "other$00$00"]) {
    assert.doesNotThrow(() => verifyPassword("valid password", stored));
    assert.equal(verifyPassword("valid password", stored), false);
  }
});

test("isPasswordValid enforces inclusive password length bounds", () => {
  assert.equal(PASSWORD_MIN_LENGTH, 8);
  assert.equal(PASSWORD_MAX_LENGTH, 128);
  assert.equal(isPasswordValid("a".repeat(7)), false);
  assert.equal(isPasswordValid("a".repeat(8)), true);
  assert.equal(isPasswordValid("a".repeat(128)), true);
  assert.equal(isPasswordValid("a".repeat(129)), false);
  assert.equal(isPasswordValid(12345678), false);
});
