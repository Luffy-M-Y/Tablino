import assert from "node:assert/strict";
import test from "node:test";
import { decideStudentAccess } from "../src/access-gate";

test("decideStudentAccess denies revoked students even when their trial is active", () => {
  const now = new Date("2026-10-25T00:00:00.000Z");

  assert.equal(decideStudentAccess({
    revokedAt: now,
    trialEndsAt: new Date(now.getTime() + 1),
    subscriptionExpiresAt: null,
  }, now), "revoked");
});

test("decideStudentAccess requires a subscription when no trial or payment exists", () => {
  const now = new Date("2026-10-25T00:00:00.000Z");

  assert.equal(decideStudentAccess({
    revokedAt: null,
    trialEndsAt: null,
    subscriptionExpiresAt: null,
  }, now), "subscription_required");
});

test("decideStudentAccess allows an active trial", () => {
  const now = new Date("2026-10-25T00:00:00.000Z");

  assert.equal(decideStudentAccess({
    revokedAt: null,
    trialEndsAt: new Date(now.getTime() + 1),
    subscriptionExpiresAt: null,
  }, now), "allowed");
});

test("decideStudentAccess requires a subscription after the trial expires", () => {
  const now = new Date("2026-10-25T00:00:00.000Z");

  assert.equal(decideStudentAccess({
    revokedAt: null,
    trialEndsAt: new Date(now.getTime() - 1),
    subscriptionExpiresAt: null,
  }, now), "subscription_required");
});

test("decideStudentAccess allows an active payment", () => {
  const now = new Date("2026-10-25T00:00:00.000Z");

  assert.equal(decideStudentAccess({
    revokedAt: null,
    trialEndsAt: null,
    subscriptionExpiresAt: new Date(now.getTime() + 1),
  }, now), "allowed");
});

test("decideStudentAccess requires a subscription after trial and payment expire", () => {
  const now = new Date("2026-10-25T00:00:00.000Z");

  assert.equal(decideStudentAccess({
    revokedAt: null,
    trialEndsAt: new Date(now.getTime() - 1),
    subscriptionExpiresAt: new Date(now.getTime() - 1),
  }, now), "subscription_required");
});

test("decideStudentAccess requires a subscription when the trial ends now", () => {
  const now = new Date("2026-10-25T00:00:00.000Z");

  assert.equal(decideStudentAccess({
    revokedAt: null,
    trialEndsAt: now,
    subscriptionExpiresAt: null,
  }, now), "subscription_required");
});

test("decideStudentAccess requires a subscription when payment expires now", () => {
  const now = new Date("2026-10-25T00:00:00.000Z");

  assert.equal(decideStudentAccess({
    revokedAt: null,
    trialEndsAt: null,
    subscriptionExpiresAt: now,
  }, now), "subscription_required");
});
