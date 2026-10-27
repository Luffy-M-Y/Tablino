import assert from "node:assert/strict";
import test from "node:test";
import {
  createGoogleSignupToken,
  GOOGLE_SIGNUP_TOKEN_TTL_MS,
  verifyGoogleSignupToken,
  type GoogleSignupPayload,
} from "../src/google-signup-token";

const secret = "test-signing-secret-with-enough-length";
const now = 1_798_000_000_000;
const payload: GoogleSignupPayload = {
  email: "student@example.com",
  name: "Ada Lovelace",
  image: "https://example.com/avatar.png",
  providerAccountId: "google-account-id",
};

test("Google signup token round trips its payload", () => {
  const token = createGoogleSignupToken(payload, now, secret);

  assert.deepEqual(verifyGoogleSignupToken(token, now, secret), payload);
});

test("Google signup token rejects a modified payload", () => {
  const token = createGoogleSignupToken(payload, now, secret);
  const [encoded, signature] = token.split(".");
  const modified = Buffer.from(encoded, "base64url").toString("utf8")
    .replace("student@example.com", "other@example.com");
  const changedToken = Buffer.from(modified).toString("base64url") + "." + signature;

  assert.equal(verifyGoogleSignupToken(changedToken, now, secret), null);
});

test("Google signup token rejects a modified signature", () => {
  const token = createGoogleSignupToken(payload, now, secret);
  const [encoded, signature] = token.split(".");
  const changedSignature = (signature[0] === "A" ? "B" : "A") + signature.slice(1);

  assert.equal(verifyGoogleSignupToken(encoded + "." + changedSignature, now, secret), null);
});

test("Google signup token rejects an expired payload", () => {
  const token = createGoogleSignupToken(payload, now, secret);

  assert.equal(verifyGoogleSignupToken(token, now + GOOGLE_SIGNUP_TOKEN_TTL_MS + 1, secret), null);
});

test("Google signup token remains valid just before expiration", () => {
  const token = createGoogleSignupToken(payload, now, secret);

  assert.deepEqual(
    verifyGoogleSignupToken(token, now + GOOGLE_SIGNUP_TOKEN_TTL_MS - 1, secret),
    payload,
  );
});

test("Google signup token rejects a different secret", () => {
  const token = createGoogleSignupToken(payload, now, secret);

  assert.equal(verifyGoogleSignupToken(token, now, "another-test-secret-with-length"), null);
});

test("Google signup token rejects malformed tokens", () => {
  for (const token of ["", "without-a-dot", "one.two.three"]) {
    assert.equal(verifyGoogleSignupToken(token, now, secret), null);
  }
});

test("Google signup token creation rejects a short secret", () => {
  assert.throws(
    () => createGoogleSignupToken(payload, now, "short"),
    { message: "Secret de signature absent." },
  );
});

test("Google signup token preserves null name and image", () => {
  const nullablePayload = { ...payload, name: null, image: null };
  const token = createGoogleSignupToken(nullablePayload, now, secret);

  assert.deepEqual(verifyGoogleSignupToken(token, now, secret), nullablePayload);
});
