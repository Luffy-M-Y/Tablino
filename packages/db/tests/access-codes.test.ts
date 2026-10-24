import assert from "node:assert/strict";
import test from "node:test";
import {
  ACCESS_CODE_ALPHABET,
  computeAccessCodeExpiry,
  generateAccessCode,
  getAccessCodeStatus,
  hashAccessCode,
  isAccessCodeFormatValid,
  isMaxUsesValid,
  normalizeAccessCode,
} from "../src/access-codes";

test("generateAccessCode returns twelve alphabet characters in three groups and differs across calls", () => {
  const first = generateAccessCode();
  const second = generateAccessCode();
  const normalized = first.split("-").join("");

  assert.equal(first.length, 14);
  assert.equal(first[4], "-");
  assert.equal(first[9], "-");
  assert.equal(normalized.length, 12);
  assert.equal(Array.from(normalized).every((character) => ACCESS_CODE_ALPHABET.includes(character)), true);
  assert.notEqual(first, second);
});

test("normalizeAccessCode trims, uppercases, and removes hyphens and spaces", () => {
  assert.equal(normalizeAccessCode(" abcd-efgh-jklm "), "ABCDEFGHJKLM");
});

test("isAccessCodeFormatValid accepts only twelve allowed characters", () => {
  assert.equal(isAccessCodeFormatValid("ABCDEFGHJKLM"), true);
  assert.equal(isAccessCodeFormatValid("ABCDEFGHIJK"), false);
  assert.equal(isAccessCodeFormatValid("ABCDEFGHJKLO"), false);
  assert.equal(isAccessCodeFormatValid("ABCDEFGHJKLI"), false);
  assert.equal(isAccessCodeFormatValid("ABCDEFGHJKL0"), false);
  assert.equal(isAccessCodeFormatValid("ABCDEFGHJKL1"), false);
});

test("hashAccessCode hashes the normalized code", () => {
  const hash = hashAccessCode("ABCD-EFGH-JKLM");

  assert.equal(hash.length, 64);
  assert.equal(hashAccessCode("ABCD-EFGH-JKLM"), hashAccessCode("ABCDEFGHJKLM"));
  assert.notEqual(hashAccessCode("ABCDEFGHJKLM"), hashAccessCode("BCDEFGHJKLMN"));
});

test("isMaxUsesValid accepts the inclusive limit and rejects invalid values", () => {
  assert.equal(isMaxUsesValid(1), true);
  assert.equal(isMaxUsesValid(5000), true);
  assert.equal(isMaxUsesValid(0), false);
  assert.equal(isMaxUsesValid(5001), false);
  assert.equal(isMaxUsesValid(1.5), false);
  assert.equal(isMaxUsesValid(Number.NaN), false);
  assert.equal(isMaxUsesValid("1"), false);
});

test("computeAccessCodeExpiry returns exactly twenty-four hours later", () => {
  const now = new Date("2026-10-24T00:00:00.000Z");
  const expiry = computeAccessCodeExpiry(now);

  assert.equal(expiry.getTime() - now.getTime(), 24 * 60 * 60 * 1000);
});

test("getAccessCodeStatus reports usable, revoked, expired, and exhausted states", () => {
  const now = new Date("2026-10-24T00:00:00.000Z");

  assert.equal(getAccessCodeStatus({
    expiresAt: new Date(now.getTime() + 1),
    revokedAt: null,
    usesCount: 0,
    maxUses: 1,
  }, now), "usable");
  assert.equal(getAccessCodeStatus({
    expiresAt: new Date(now.getTime() + 1),
    revokedAt: new Date(now.getTime()),
    usesCount: 0,
    maxUses: 1,
  }, now), "revoked");
  assert.equal(getAccessCodeStatus({
    expiresAt: now,
    revokedAt: null,
    usesCount: 0,
    maxUses: 1,
  }, now), "expired");
  assert.equal(getAccessCodeStatus({
    expiresAt: new Date(now.getTime() + 1),
    revokedAt: null,
    usesCount: 1,
    maxUses: 1,
  }, now), "exhausted");
});

test("revoked status takes priority over expired status", () => {
  const now = new Date("2026-10-24T00:00:00.000Z");

  assert.equal(getAccessCodeStatus({
    expiresAt: now,
    revokedAt: new Date(now.getTime()),
    usesCount: 1,
    maxUses: 1,
  }, now), "revoked");
});
