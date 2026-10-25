import assert from "node:assert/strict";
import test from "node:test";
import {
  canDownload,
  computePaidPeriod,
  computeRevenueShare,
  computeTrialEnd,
  getAccessState,
  hasAccess,
  isPlanValid,
} from "../src/plans";

test("computeRevenueShare splits amounts and preserves the total", () => {
  const validCases = [
    { amountXof: 1000, shareBps: 3000, universityAmount: 300, platformAmount: 700 },
    { amountXof: 1001, shareBps: 3000, universityAmount: 300, platformAmount: 701 },
    { amountXof: 1000, shareBps: 0, universityAmount: 0, platformAmount: 1000 },
    { amountXof: 1000, shareBps: 10000, universityAmount: 1000, platformAmount: 0 },
  ];

  for (const expected of validCases) {
    const result = computeRevenueShare(expected.amountXof, expected.shareBps);

    assert.deepEqual(result, {
      ok: true,
      universityAmount: expected.universityAmount,
      platformAmount: expected.platformAmount,
    });
    if (result.ok) {
      assert.equal(result.universityAmount + result.platformAmount, expected.amountXof);
    }
  }

  for (const amountXof of [0, 1.5, Number.NaN]) {
    assert.deepEqual(computeRevenueShare(amountXof, 3000), {
      ok: false,
      reason: "invalid_amount",
    });
  }
  for (const shareBps of [-1, 10001, 0.5]) {
    assert.deepEqual(computeRevenueShare(1000, shareBps), {
      ok: false,
      reason: "invalid_share",
    });
  }
});

test("computeTrialEnd returns exactly thirty days later", () => {
  const start = new Date("2026-10-25T00:00:00.000Z");

  assert.equal(
    computeTrialEnd(start).getTime() - start.getTime(),
    30 * 24 * 60 * 60 * 1000,
  );
});

test("computePaidPeriod starts at the later date and adds the plan duration", () => {
  const now = new Date("2026-10-25T00:00:00.000Z");
  const duration = 30 * 24 * 60 * 60 * 1000;
  const periods = [
    { accessUntil: null, expectedStart: now },
    { accessUntil: new Date(now.getTime() + 1000), expectedStart: new Date(now.getTime() + 1000) },
    { accessUntil: new Date(now.getTime() - 1000), expectedStart: now },
  ];

  for (const period of periods) {
    const result = computePaidPeriod(period.accessUntil, now, "premium_pro");

    assert.equal(result.periodStart.getTime(), period.expectedStart.getTime());
    assert.equal(result.periodEnd.getTime(), period.expectedStart.getTime() + duration);
  }
});

test("getAccessState returns all states and prioritizes paid access", () => {
  const now = new Date("2026-10-25T00:00:00.000Z");

  assert.equal(getAccessState({ trialEndsAt: null, paidUntil: null }, now), "none");
  assert.equal(
    getAccessState({ trialEndsAt: new Date(now.getTime() + 1), paidUntil: null }, now),
    "trial",
  );
  assert.equal(
    getAccessState({ trialEndsAt: null, paidUntil: new Date(now.getTime() + 1) }, now),
    "paid",
  );
  assert.equal(
    getAccessState({ trialEndsAt: now, paidUntil: null }, now),
    "expired",
  );
  assert.equal(
    getAccessState({
      trialEndsAt: new Date(now.getTime() + 1),
      paidUntil: new Date(now.getTime() + 1),
    }, now),
    "paid",
  );
});

test("hasAccess allows trial and paid states only", () => {
  assert.equal(hasAccess("trial"), true);
  assert.equal(hasAccess("paid"), true);
  assert.equal(hasAccess("none"), false);
  assert.equal(hasAccess("expired"), false);
});

test("canDownload requires a paid premium_pro_max plan", () => {
  assert.equal(canDownload("premium_pro_max", "paid"), true);
  assert.equal(canDownload("premium_pro", "paid"), false);
  assert.equal(canDownload("premium_pro_max", "trial"), false);
  assert.equal(canDownload("premium_pro_max", "expired"), false);
  assert.equal(canDownload(null, "paid"), false);
});

test("isPlanValid accepts only configured plans", () => {
  assert.equal(isPlanValid("premium_pro"), true);
  assert.equal(isPlanValid("premium_pro_max"), true);
  assert.equal(isPlanValid("pro"), false);
  assert.equal(isPlanValid(1), false);
  assert.equal(isPlanValid(null), false);
});
