import assert from "node:assert/strict";
import test from "node:test";
import { createGoogleSignupToken } from "../src/google-signup-token";
import {
  createEmailVerificationToken,
  EMAIL_VERIFICATION_TOKEN_TTL_MS,
  getEmailVerificationCookieConfig,
  verifyEmailVerificationToken,
} from "../src/email-verification-token";

const secret = "test-signing-secret-with-enough-length";
const now = 1_798_000_000_000;
const userId = "student-id";

test("Email verification token round trips its user ID", () => {
  const token = createEmailVerificationToken(userId, now, secret);

  assert.equal(verifyEmailVerificationToken(token, now, secret), userId);
});

test("Email verification token rejects a modified signature", () => {
  const token = createEmailVerificationToken(userId, now, secret);
  const [encoded, signature] = token.split(".");
  const changedSignature = (signature[0] === "A" ? "B" : "A") + signature.slice(1);

  assert.equal(
    verifyEmailVerificationToken(encoded + "." + changedSignature, now, secret),
    null,
  );
});

test("Email verification token rejects an expired payload", () => {
  const token = createEmailVerificationToken(userId, now, secret);

  assert.equal(
    verifyEmailVerificationToken(token, now + EMAIL_VERIFICATION_TOKEN_TTL_MS + 1, secret),
    null,
  );
});

test("Email verification token rejects a Google signup token", () => {
  const googleToken = createGoogleSignupToken({
    email: "student@example.com",
    name: null,
    image: null,
    providerAccountId: "google-account-id",
  }, now, secret);

  assert.equal(verifyEmailVerificationToken(googleToken, now, secret), null);
});

test("Email verification token rejects malformed tokens", () => {
  for (const token of ["", "without-a-dot", "one.two.three"]) {
    assert.equal(verifyEmailVerificationToken(token, now, secret), null);
  }
});

test("Email verification token creation rejects a short secret", () => {
  assert.throws(
    () => createEmailVerificationToken(userId, now, "short"),
    { message: "Secret de signature absent." },
  );
});

test("Email verification cookie config omits the secure prefix over HTTP", () => {
  const originalUrl = process.env.NEXTAUTH_URL;
  process.env.NEXTAUTH_URL = "http://localhost";
  try {
    const config = getEmailVerificationCookieConfig();

    assert.equal(config.name, "tablino-web.email-verification");
    assert.equal(config.options.secure, false);
  } finally {
    if (originalUrl === undefined) {
      delete process.env.NEXTAUTH_URL;
    } else {
      process.env.NEXTAUTH_URL = originalUrl;
    }
  }
});

test("Email verification cookie config adds the secure prefix over HTTPS", () => {
  const originalUrl = process.env.NEXTAUTH_URL;
  process.env.NEXTAUTH_URL = "https://example.com";
  try {
    const config = getEmailVerificationCookieConfig();

    assert.equal(config.name, "__Secure-tablino-web.email-verification");
    assert.equal(config.options.secure, true);
  } finally {
    if (originalUrl === undefined) {
      delete process.env.NEXTAUTH_URL;
    } else {
      process.env.NEXTAUTH_URL = originalUrl;
    }
  }
});
