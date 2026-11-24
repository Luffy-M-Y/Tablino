import assert from "node:assert/strict";
import test from "node:test";
import {
  findFirstInvalidSignupStep,
  SIGNUP_STEPS,
  validateSignupStep,
} from "../src/lib/signup-steps.mjs";

const VALID = {
  universityName: "Université de Ouaga",
  acronym: "UO",
  locality: "",
  visibility: "private",
  phone: "70 12 34 56",
  email: "admin@example.com",
  password: "motdepasse1",
  passwordConfirmation: "motdepasse1",
};

test("signup steps are university, access, account then review", () => {
  assert.deepEqual(SIGNUP_STEPS.map((step) => step.id), ["university", "access", "account", "review"]);
  assert.ok(Object.isFrozen(SIGNUP_STEPS));
});

test("a complete form passes every step", () => {
  for (const step of SIGNUP_STEPS) assert.equal(validateSignupStep(step.id, VALID), null);
  assert.equal(findFirstInvalidSignupStep(VALID), null);
});

test("the university step requires a name and an acronym within their limits", () => {
  assert.match(validateSignupStep("university", { ...VALID, universityName: "   " }), /nom/);
  assert.match(validateSignupStep("university", { ...VALID, universityName: "x".repeat(256) }), /trop long/);
  assert.match(validateSignupStep("university", { ...VALID, acronym: " " }), /acronyme/i);
  assert.match(validateSignupStep("university", { ...VALID, acronym: "A".repeat(21) }), /trop long/);
  assert.match(validateSignupStep("university", { ...VALID, locality: "x".repeat(61) }), /localité/);
  assert.equal(validateSignupStep("university", { ...VALID, locality: "Bobo" }), null);
});

test("the access step accepts only private or public", () => {
  assert.equal(validateSignupStep("access", { ...VALID, visibility: "public" }), null);
  assert.match(validateSignupStep("access", { ...VALID, visibility: "" }), /visibilité/);
  assert.match(validateSignupStep("access", { ...VALID, visibility: "secret" }), /visibilité/);
});

test("the account step checks email, phone and matching passwords", () => {
  assert.match(validateSignupStep("account", { ...VALID, email: "" }), /obligatoire/);
  assert.match(validateSignupStep("account", { ...VALID, email: "pas-une-adresse" }), /invalide/);
  assert.match(validateSignupStep("account", { ...VALID, phone: "" }), /téléphone/);
  assert.match(validateSignupStep("account", { ...VALID, phone: "+226 70123456" }), /indicatif/);
  assert.match(validateSignupStep("account", { ...VALID, password: "court", passwordConfirmation: "court" }), /8 à 128/);
  assert.match(
    validateSignupStep("account", { ...VALID, password: "x".repeat(129), passwordConfirmation: "x".repeat(129) }),
    /8 à 128/,
  );
  assert.match(validateSignupStep("account", { ...VALID, passwordConfirmation: "autre-mot" }), /correspondent/);
});

test("findFirstInvalidSignupStep returns the earliest invalid step", () => {
  assert.deepEqual(
    findFirstInvalidSignupStep({ ...VALID, acronym: "", passwordConfirmation: "autre" }),
    { step: "university", error: "L’acronyme de l’université est obligatoire." },
  );
  assert.equal(findFirstInvalidSignupStep({ ...VALID, email: "x" }).step, "account");
});
