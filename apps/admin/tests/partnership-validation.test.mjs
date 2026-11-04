import assert from "node:assert/strict";
import test from "node:test";
import {
  ALLOWED_OPERATORS,
  validatePartnershipInput,
} from "../src/lib/partnership-validation.mjs";

test("ALLOWED_OPERATORS contains only whitelisted operators", () => {
  assert.deepEqual(ALLOWED_OPERATORS, ["Orange Money", "Moov Money"]);
});

test("validatePartnershipInput accepts valid inputs with whitelisted operators", () => {
  const resultOrange = validatePartnershipInput({
    operator: "Orange Money",
    holderName: "Université Joseph Ki-Zerbo",
    acceptContract: true,
  });
  assert.equal(resultOrange.ok, true);
  if (resultOrange.ok) {
    assert.deepEqual(resultOrange.data, {
      operator: "Orange Money",
      holderName: "Université Joseph Ki-Zerbo",
      acceptContract: true,
    });
  }

  const resultMoov = validatePartnershipInput({
    operator: "  Moov Money  ",
    holderName: "  Agent Comptable  ",
    acceptContract: "on",
  });
  assert.equal(resultMoov.ok, true);
  if (resultMoov.ok) {
    assert.deepEqual(resultMoov.data, {
      operator: "Moov Money",
      holderName: "Agent Comptable",
      acceptContract: true,
    });
  }
});

test("validatePartnershipInput rejects non-whitelisted operator", () => {
  const invalidOps = ["Wave", "MTN", "Coris Money", "", null, undefined];
  for (const op of invalidOps) {
    const res = validatePartnershipInput({
      operator: op,
      holderName: "Agent Comptable",
      acceptContract: true,
    });
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.ok(res.errors.operator);
    }
  }
});

test("validatePartnershipInput enforces holder name length between 2 and 100 after trim", () => {
  const tooShort = ["", " ", "a", "   b   "];
  for (const name of tooShort) {
    const res = validatePartnershipInput({
      operator: "Orange Money",
      holderName: name,
      acceptContract: true,
    });
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.ok(res.errors.holderName);
    }
  }

  const exactly100 = "a".repeat(100);
  const valid100 = validatePartnershipInput({
    operator: "Orange Money",
    holderName: `  ${exactly100}  `,
    acceptContract: true,
  });
  assert.equal(valid100.ok, true);

  const tooLong = "a".repeat(101);
  const invalid101 = validatePartnershipInput({
    operator: "Orange Money",
    holderName: tooLong,
    acceptContract: true,
  });
  assert.equal(invalid101.ok, false);
  if (!invalid101.ok) {
    assert.ok(invalid101.errors.holderName);
  }
});

test("validatePartnershipInput requires contract acceptance", () => {
  const invalidAccept = [false, null, undefined, "", "off", "no"];
  for (const accept of invalidAccept) {
    const res = validatePartnershipInput({
      operator: "Orange Money",
      holderName: "Titulaire Valide",
      acceptContract: accept,
    });
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.ok(res.errors.acceptContract);
    }
  }
});

test("validatePartnershipInput handles null or non-object input", () => {
  const resNull = validatePartnershipInput(null);
  assert.equal(resNull.ok, false);

  const resUndefined = validatePartnershipInput(undefined);
  assert.equal(resUndefined.ok, false);
});

