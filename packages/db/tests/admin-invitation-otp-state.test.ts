import assert from "node:assert/strict";
import test from "node:test";
import {
  isAdminInvitationCodeAttemptAllowed,
  isAdminInvitationCodeResendAllowed,
} from "../src/admin-invitation-otp-state.mjs";

const NOW = new Date("2026-11-14T12:00:00.000Z");
const MAX_ATTEMPTS = 5;
const RESEND_DELAY_MS = 60 * 1000;

test("OTP codes are rejected at expiration", () => {
  assert.equal(isAdminInvitationCodeAttemptAllowed({
    consumedAt: null,
    expiresAt: NOW,
    attempts: 0,
  }, NOW, MAX_ATTEMPTS), false);
});

test("the fifth failed attempt exhausts OTP verification", () => {
  assert.equal(isAdminInvitationCodeAttemptAllowed({
    consumedAt: null,
    expiresAt: new Date(NOW.getTime() + 60_000),
    attempts: MAX_ATTEMPTS - 1,
  }, NOW, MAX_ATTEMPTS), true);
  assert.equal(isAdminInvitationCodeAttemptAllowed({
    consumedAt: null,
    expiresAt: new Date(NOW.getTime() + 60_000),
    attempts: MAX_ATTEMPTS,
  }, NOW, MAX_ATTEMPTS), false);
});

test("a consumed OTP is not eligible even before expiry", () => {
  assert.equal(isAdminInvitationCodeAttemptAllowed({
    consumedAt: NOW,
    expiresAt: new Date(NOW.getTime() + 60_000),
    attempts: 0,
  }, NOW, MAX_ATTEMPTS), false);
});

test("OTP resend unlocks exactly 60 seconds after the last send", () => {
  const sentAt = new Date(NOW.getTime() - RESEND_DELAY_MS);
  assert.equal(isAdminInvitationCodeResendAllowed(sentAt, NOW, RESEND_DELAY_MS), true);
  assert.equal(
    isAdminInvitationCodeResendAllowed(
      new Date(sentAt.getTime() + 1),
      NOW,
      RESEND_DELAY_MS,
    ),
    false,
  );
});
