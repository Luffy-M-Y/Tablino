import assert from "node:assert/strict";
import test from "node:test";
import {
  buildLevelName,
  buildLevelSlug,
  isCycleValid,
  isProgramStatusValid,
  isShortCodeValid,
  isYearNumberInRange,
  normalizeShortCode,
  normalizeCycleName,
} from "../src/structure-validation";

test("cycle validation trims a 1 to 100 character name and normalizes the short code", () => {
  assert.equal(normalizeCycleName("  Licence  "), "Licence");
  assert.equal(isCycleValid("  Licence  ", " l "), true);
  assert.equal(isCycleValid("x", "L"), true);
  assert.equal(isCycleValid("x".repeat(100), "L"), true);
  assert.equal(isCycleValid("   ", "L"), false);
  assert.equal(isCycleValid("x".repeat(101), "L"), false);
  assert.equal(isCycleValid("Licence", "ABCDEFGHIJK"), false);
  assert.equal(isCycleValid("Licence", "A1"), false);
});

test("program status validation accepts only draft and published", () => {
  assert.equal(isProgramStatusValid("draft"), true);
  assert.equal(isProgramStatusValid("published"), true);
  assert.equal(isProgramStatusValid("archived"), false);
  assert.equal(isProgramStatusValid(null), false);
});

test("year number validation accepts only integers within the cycle range", () => {
  assert.equal(isYearNumberInRange(1, 3), true);
  assert.equal(isYearNumberInRange(3, 3), true);
  assert.equal(isYearNumberInRange(0, 3), false);
  assert.equal(isYearNumberInRange(4, 3), false);
  assert.equal(isYearNumberInRange(2.5, 3), false);
  assert.equal(isYearNumberInRange(Number.NaN, 3), false);
});

test("short code validation accepts one to ten letters only", () => {
  assert.equal(isShortCodeValid("L"), true);
  assert.equal(isShortCodeValid("Doctorat"), true);
  assert.equal(isShortCodeValid(""), false);
  assert.equal(isShortCodeValid("L\n"), false);
  assert.equal(isShortCodeValid("ABCDEFGHIJK"), false);
  assert.equal(isShortCodeValid("A1"), false);
  assert.equal(isShortCodeValid("A-B"), false);
});

test("short code normalization trims whitespace and uppercases letters", () => {
  assert.equal(normalizeShortCode("  zz "), "ZZ");
  assert.equal(isShortCodeValid(normalizeShortCode("  zz ")), true);
  assert.equal(isShortCodeValid(normalizeShortCode("  z-1 ")), false);
});

test("level names preserve the cycle code and append the year number", () => {
  assert.equal(buildLevelName("M", 2), "M2");
});

test("level slugs lowercase the cycle code and append the year number", () => {
  assert.equal(buildLevelSlug("DOC", 3), "doc3");
});
