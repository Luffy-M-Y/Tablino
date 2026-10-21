import assert from "node:assert/strict";
import test from "node:test";
import {
  buildLevelName,
  buildLevelSlug,
  isShortCodeValid,
  isYearNumberInRange,
} from "../src/structure-validation";

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

test("level names preserve the cycle code and append the year number", () => {
  assert.equal(buildLevelName("M", 2), "M2");
});

test("level slugs lowercase the cycle code and append the year number", () => {
  assert.equal(buildLevelSlug("DOC", 3), "doc3");
});
