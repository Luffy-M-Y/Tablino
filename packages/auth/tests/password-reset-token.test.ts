import assert from "node:assert/strict";
import test from "node:test";
import { createGoogleSignupToken } from "../src/google-signup-token";
import { createEmailVerificationToken } from "../src/email-verification-token";
import {
  createPasswordResetConfirmedToken,
  createPasswordResetToken,
  getPasswordResetConfirmedCookieConfig,
  getPasswordResetCookieConfig,
  PASSWORD_RESET_CONFIRMED_TOKEN_TTL_MS,
  PASSWORD_RESET_TOKEN_TTL_MS,
  verifyPasswordResetConfirmedToken,
  verifyPasswordResetToken,
} from "../src/password-reset-token";

const secret = "test-signing-secret-with-enough-length";
const now = 1_798_000_000_000;
const userId = "student-id";

test("password reset token round trips its user ID", () => {
  const token = createPasswordResetToken(userId, now, secret);

  assert.equal(verifyPasswordResetToken(token, now, secret), userId);
});

test("password reset token does not expose its identifier in plaintext", () => {
  const identifiedUserId = "user@example.com";
  const token = createPasswordResetToken(identifiedUserId, now, secret);

  assert.equal(token.includes(identifiedUserId), false);
  assert.equal(Buffer.from(token, "base64url").toString("utf8").includes(identifiedUserId), false);
  assert.equal(verifyPasswordResetToken(token, now, secret), identifiedUserId);
});

test("password reset token cannot be verified without the signing secret", () => {
  const token = createPasswordResetToken(userId, now, secret);

  assert.equal(verifyPasswordResetToken(token, now, "another-long-enough-secret"), null);
});

test("password reset token rejects a tampered ciphertext", () => {
  const token = createPasswordResetToken(userId, now, secret);
  const bytes = Buffer.from(token, "base64url");
  const tampered = Buffer.from(bytes);
  tampered[tampered.length - 1] ^= 1;

  assert.equal(verifyPasswordResetToken(tampered.toString("base64url"), now, secret), null);
});

test("password reset token rejects an expired payload", () => {
  const token = createPasswordResetToken(userId, now, secret);

  assert.equal(
    verifyPasswordResetToken(token, now + PASSWORD_RESET_TOKEN_TTL_MS + 1, secret),
    null,
  );
});

test("password reset confirmed token round trips its user ID", () => {
  const token = createPasswordResetConfirmedToken(userId, now, secret);

  assert.equal(verifyPasswordResetConfirmedToken(token, now, secret), userId);
});

test("password reset confirmed token rejects an expired payload", () => {
  const token = createPasswordResetConfirmedToken(userId, now, secret);

  assert.equal(
    verifyPasswordResetConfirmedToken(
      token,
      now + PASSWORD_RESET_CONFIRMED_TOKEN_TTL_MS + 1,
      secret,
    ),
    null,
  );
});

test("password reset token is rejected by the confirmed verifier", () => {
  const token = createPasswordResetToken(userId, now, secret);

  assert.equal(verifyPasswordResetConfirmedToken(token, now, secret), null);
});

test("password reset confirmed token is rejected by the reset verifier", () => {
  const token = createPasswordResetConfirmedToken(userId, now, secret);

  assert.equal(verifyPasswordResetToken(token, now, secret), null);
});

test("password reset verifier rejects an email verification token", () => {
  const emailToken = createEmailVerificationToken(userId, now, secret);

  assert.equal(verifyPasswordResetToken(emailToken, now, secret), null);
});

test("password reset verifier rejects a Google signup token", () => {
  const googleToken = createGoogleSignupToken({
    email: "student@example.com",
    name: null,
    image: null,
    providerAccountId: "google-account-id",
  }, now, secret);

  assert.equal(verifyPasswordResetToken(googleToken, now, secret), null);
});

test("password reset tokens reject malformed tokens", () => {
  for (const token of ["", "without-a-dot", "one.two.three"]) {
    assert.equal(verifyPasswordResetToken(token, now, secret), null);
    assert.equal(verifyPasswordResetConfirmedToken(token, now, secret), null);
  }
});

test("password reset token creation rejects a short secret", () => {
  assert.throws(
    () => createPasswordResetToken(userId, now, "short"),
    { message: "Secret de signature absent." },
  );
});

test("password reset cookie config omits the secure prefix over HTTP", () => {
  const originalUrl = process.env.NEXTAUTH_URL;
  process.env.NEXTAUTH_URL = "http://localhost";
  try {
    const config = getPasswordResetCookieConfig();

    assert.equal(config.name, "tablino-web.password-reset");
    assert.equal(config.options.secure, false);
  } finally {
    if (originalUrl === undefined) {
      delete process.env.NEXTAUTH_URL;
    } else {
      process.env.NEXTAUTH_URL = originalUrl;
    }
  }
});

test("password reset cookie config adds the secure prefix over HTTPS", () => {
  const originalUrl = process.env.NEXTAUTH_URL;
  process.env.NEXTAUTH_URL = "https://example.com";
  try {
    const config = getPasswordResetCookieConfig();

    assert.equal(config.name, "__Secure-tablino-web.password-reset");
    assert.equal(config.options.secure, true);
  } finally {
    if (originalUrl === undefined) {
      delete process.env.NEXTAUTH_URL;
    } else {
      process.env.NEXTAUTH_URL = originalUrl;
    }
  }
});

test("password reset confirmed cookie config omits the secure prefix over HTTP", () => {
  const originalUrl = process.env.NEXTAUTH_URL;
  process.env.NEXTAUTH_URL = "http://localhost";
  try {
    const config = getPasswordResetConfirmedCookieConfig();

    assert.equal(config.name, "tablino-web.password-reset-confirmed");
    assert.equal(config.options.secure, false);
  } finally {
    if (originalUrl === undefined) {
      delete process.env.NEXTAUTH_URL;
    } else {
      process.env.NEXTAUTH_URL = originalUrl;
    }
  }
});
