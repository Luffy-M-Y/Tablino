import assert from "node:assert/strict";
import test from "node:test";
import {
  accessStatusLabel,
  accessStatusSpokenLabel,
  describeAccessStatus,
  formatAccessDate,
} from "../src/lib/access-status.mjs";

const NOW = new Date("2026-11-25T10:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const at = (offsetMs) => new Date(NOW.getTime() + offsetMs);
const user = (fields) => ({ revokedAt: null, trialEndsAt: null, subscriptionExpiresAt: null, ...fields });

test("describeAccessStatus reports a running trial with the remaining days rounded up", () => {
  assert.deepEqual(describeAccessStatus(user({ trialEndsAt: at(12 * DAY) }), NOW), {
    kind: "trial",
    endsAt: at(12 * DAY),
    daysLeft: 12,
  });
  assert.equal(describeAccessStatus(user({ trialEndsAt: at(DAY / 2) }), NOW).daysLeft, 1);
  assert.equal(describeAccessStatus(user({ trialEndsAt: at(DAY + 1) }), NOW).daysLeft, 2);
});

test("describeAccessStatus puts a running subscription before the trial", () => {
  assert.deepEqual(
    describeAccessStatus(user({ trialEndsAt: at(5 * DAY), subscriptionExpiresAt: at(20 * DAY) }), NOW),
    { kind: "pro", endsAt: at(20 * DAY) },
  );
});

test("describeAccessStatus reports an ended access with its latest end date", () => {
  assert.deepEqual(describeAccessStatus(user({ trialEndsAt: at(-3 * DAY) }), NOW), { kind: "expired", endedAt: at(-3 * DAY) });
  assert.deepEqual(
    describeAccessStatus(user({ trialEndsAt: at(-40 * DAY), subscriptionExpiresAt: at(-2 * DAY) }), NOW),
    { kind: "expired", endedAt: at(-2 * DAY) },
  );
  assert.equal(describeAccessStatus(user({ trialEndsAt: NOW }), NOW).kind, "expired");
});

test("describeAccessStatus reports no access, and revoked before anything else", () => {
  assert.deepEqual(describeAccessStatus(user({}), NOW), { kind: "none" });
  assert.deepEqual(
    describeAccessStatus(user({ revokedAt: at(-DAY), subscriptionExpiresAt: at(20 * DAY) }), NOW),
    { kind: "revoked" },
  );
  assert.deepEqual(describeAccessStatus(user({ trialEndsAt: new Date("invalide") }), NOW), { kind: "none" });
});

test("accessStatusLabel shows only a running trial or Pro", () => {
  assert.equal(accessStatusLabel({ kind: "trial", endsAt: at(DAY), daysLeft: 12 }), "Essai gratuit · 12 j");
  assert.equal(accessStatusLabel({ kind: "pro", endsAt: at(DAY) }), "Pro");
  for (const status of [{ kind: "expired", endedAt: NOW }, { kind: "none" }, { kind: "revoked" }]) {
    assert.equal(accessStatusLabel(status), null, status.kind);
    assert.equal(accessStatusSpokenLabel(status), null, status.kind);
  }
});

test("accessStatusSpokenLabel spells out the remaining days", () => {
  assert.equal(accessStatusSpokenLabel({ kind: "trial", endsAt: at(DAY), daysLeft: 1 }), "Statut de l'accès : essai gratuit, 1 jour restant");
  assert.equal(accessStatusSpokenLabel({ kind: "trial", endsAt: at(DAY), daysLeft: 12 }), "Statut de l'accès : essai gratuit, 12 jours restants");
  assert.equal(accessStatusSpokenLabel({ kind: "pro", endsAt: at(DAY) }), "Statut de l'accès : Pro");
});

test("formatAccessDate writes a French date", () => {
  assert.equal(formatAccessDate(new Date("2026-12-24T23:30:00.000Z")), "24 décembre 2026");
});
