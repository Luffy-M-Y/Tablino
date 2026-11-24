import assert from "node:assert/strict";
import test from "node:test";
import {
  findFirstInvalidRegisterStep,
  getRegisterSteps,
  validateRegisterStep,
} from "../src/lib/register-steps.mjs";

const VALID = {
  firstName: "Awa",
  lastName: "Ouédraogo",
  email: "awa@example.com",
  password: "motdepasse1",
  passwordConfirmation: "motdepasse1",
  accessCode: "ABCD-EFGH-JKLM",
};

test("a private university adds the access code step", () => {
  assert.deepEqual(getRegisterSteps(true).map((step) => step.id), ["identity", "account", "accessCode", "review"]);
});

test("a public university has no access code step", () => {
  assert.deepEqual(getRegisterSteps(false).map((step) => step.id), ["identity", "account", "review"]);
  assert.ok(Object.isFrozen(getRegisterSteps(false)));
});

test("an unknown visibility keeps the access code step", () => {
  assert.equal(getRegisterSteps(undefined).some((step) => step.id === "accessCode"), true);
});

test("the identity step requires a first and last name within 100 characters", () => {
  assert.equal(validateRegisterStep("identity", VALID), null);
  assert.match(validateRegisterStep("identity", { ...VALID, firstName: "  " }), /prénom/);
  assert.match(validateRegisterStep("identity", { ...VALID, firstName: "x".repeat(101) }), /trop long/);
  assert.match(validateRegisterStep("identity", { ...VALID, lastName: "" }), /nom est obligatoire/);
  assert.match(validateRegisterStep("identity", { ...VALID, lastName: "x".repeat(101) }), /trop long/);
});

test("the account step checks the email and matching passwords", () => {
  assert.equal(validateRegisterStep("account", VALID), null);
  assert.match(validateRegisterStep("account", { ...VALID, email: "" }), /obligatoire/);
  assert.match(validateRegisterStep("account", { ...VALID, email: "awa@" }), /invalide/);
  assert.match(validateRegisterStep("account", { ...VALID, password: "court", passwordConfirmation: "court" }), /8 à 128/);
  assert.match(validateRegisterStep("account", { ...VALID, passwordConfirmation: "autre-mot" }), /correspondent/);
});

test("the access code step requires a code", () => {
  assert.equal(validateRegisterStep("accessCode", VALID), null);
  assert.match(validateRegisterStep("accessCode", { ...VALID, accessCode: " " }), /obligatoire/);
  assert.match(validateRegisterStep("accessCode", { ...VALID, accessCode: "x".repeat(33) }), /invalide/);
});

test("findFirstInvalidRegisterStep ignores the code step of a public university", () => {
  const values = { ...VALID, accessCode: "" };
  assert.equal(findFirstInvalidRegisterStep(getRegisterSteps(false), values), null);
  assert.deepEqual(findFirstInvalidRegisterStep(getRegisterSteps(true), values), {
    step: "accessCode",
    error: "Le code d’accès est obligatoire.",
  });
  assert.equal(findFirstInvalidRegisterStep(getRegisterSteps(true), { ...VALID, firstName: "" }).step, "identity");
});
