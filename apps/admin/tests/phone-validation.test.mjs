import assert from "node:assert/strict";
import test from "node:test";
import {
  parseAndValidateBurkinaPhone,
  validateBurkinaPhone,
} from "../src/lib/phone-validation.mjs";

test("validateBurkinaPhone accepts exactly 8 digits", () => {
  const result = validateBurkinaPhone("70123456");
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.phone, "+22670123456");
  }
});

test("validateBurkinaPhone accepts 8 digits with spaces, dots, or dashes", () => {
  const cases = [
    "70 12 34 56",
    "  70 12 34 56  ",
    "70.12.34.56",
    "70-12-34-56",
    "70 12-34.56",
  ];
  for (const input of cases) {
    const result = validateBurkinaPhone(input);
    assert.equal(result.ok, true, `Expected ${input} to be valid`);
    if (result.ok) {
      assert.equal(result.phone, "+22670123456");
    }
  }
});

test("validateBurkinaPhone rejects numbers starting with +226 or +", () => {
  const cases = ["+22670123456", "+226 70 12 34 56", "+70123456"];
  for (const input of cases) {
    const result = validateBurkinaPhone(input);
    assert.equal(result.ok, false, `Expected ${input} to be rejected`);
    if (!result.ok) {
      assert.match(result.error, /indicatif/i);
    }
  }
});

test("validateBurkinaPhone rejects numbers starting with 00226 or 00", () => {
  const cases = ["0022670123456", "00226 70 12 34 56", "0070123456"];
  for (const input of cases) {
    const result = validateBurkinaPhone(input);
    assert.equal(result.ok, false, `Expected ${input} to be rejected`);
    if (!result.ok) {
      assert.match(result.error, /indicatif/i);
    }
  }
});

test("validateBurkinaPhone rejects 226 followed by 8 digits (11 digits)", () => {
  const cases = ["22670123456", "226 70 12 34 56", "226-70-12-34-56"];
  for (const input of cases) {
    const result = validateBurkinaPhone(input);
    assert.equal(result.ok, false, `Expected ${input} to be rejected`);
    if (!result.ok) {
      assert.match(result.error, /indicatif/i);
    }
  }
});

test("validateBurkinaPhone rejects 7 and 9 digit numbers", () => {
  const tooShort = ["7012345", "70 12 34 5"];
  for (const input of tooShort) {
    const result = validateBurkinaPhone(input);
    assert.equal(result.ok, false, `Expected ${input} to be rejected`);
  }

  const tooLong = ["701234567", "70 12 34 56 7"];
  for (const input of tooLong) {
    const result = validateBurkinaPhone(input);
    assert.equal(result.ok, false, `Expected ${input} to be rejected`);
  }
});

test("validateBurkinaPhone rejects letters and non-digit characters", () => {
  const invalid = ["7012abcd", "abcdefgh", "70-12-ab-56", "telephone"];
  for (const input of invalid) {
    const result = validateBurkinaPhone(input);
    assert.equal(result.ok, false, `Expected ${input} to be rejected`);
  }
});

test("validateBurkinaPhone rejects empty or whitespace-only inputs", () => {
  const empty = ["", " ", "   \t\n", null, undefined];
  for (const input of empty) {
    const result = validateBurkinaPhone(input);
    assert.equal(result.ok, false, `Expected ${String(input)} to be rejected`);
  }
});

test("parseAndValidateBurkinaPhone alias matches validateBurkinaPhone behavior", () => {
  assert.equal(parseAndValidateBurkinaPhone, validateBurkinaPhone);
});

