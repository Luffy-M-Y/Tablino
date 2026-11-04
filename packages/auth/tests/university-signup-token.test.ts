import assert from "node:assert/strict";
import test from "node:test";
import {
  createUniversitySignupToken,
  UNIVERSITY_SIGNUP_TOKEN_TTL_MS,
  verifyUniversitySignupToken,
  type UniversitySignupPayload,
} from "../src/university-signup-token";
import {
  createGoogleSignupToken,
  verifyGoogleSignupToken,
} from "../src/google-signup-token";

const secret = "test-signing-secret-with-enough-length";
const now = 1_798_000_000_000;
const payload: UniversitySignupPayload = {
  email: "admin@example.com",
  name: "Ada Lovelace",
  image: "https://example.com/avatar.png",
  providerAccountId: "google-account-id",
};

test("University signup token round trips its payload", () => {
  const token = createUniversitySignupToken(payload, now, secret);

  assert.deepEqual(verifyUniversitySignupToken(token, now, secret), payload);
});

test("University signup token rejects an expired payload", () => {
  const token = createUniversitySignupToken(payload, now, secret);

  assert.equal(
    verifyUniversitySignupToken(token, now + UNIVERSITY_SIGNUP_TOKEN_TTL_MS + 1, secret),
    null,
  );
});

test("University signup token rejects a modified signature", () => {
  const token = createUniversitySignupToken(payload, now, secret);
  const [encoded, signature] = token.split(".");
  const changedSignature = (signature[0] === "A" ? "B" : "A") + signature.slice(1);

  assert.equal(verifyUniversitySignupToken(encoded + "." + changedSignature, now, secret), null);
});

test("University signup token rejects a student signup marker", () => {
  const studentToken = createGoogleSignupToken(payload, now, secret);

  assert.equal(verifyUniversitySignupToken(studentToken, now, secret), null);
});

test("Student signup token verification rejects a university signup token", () => {
  const universityToken = createUniversitySignupToken(payload, now, secret);

  assert.equal(verifyGoogleSignupToken(universityToken, now, secret), null);
});
