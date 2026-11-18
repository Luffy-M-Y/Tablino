import assert from "node:assert/strict";
import test from "node:test";
import {
  ADMIN_INVITATION_ALERT_LEASE_MS,
  ADMIN_INVITATION_ALERT_RETENTION_MS,
  getAdminInvitationAlertDeliveryPlan,
  getAdminInvitationAlertFailureState,
  getAdminInvitationAlertReservationState,
  isAdminInvitationAlertReservationDue,
} from "../src/admin-invitation-outbox-state.mjs";
import { isAdminInvitationRole } from "../src/admin-invitation";

const NOW = new Date("2026-11-14T12:00:00.000Z");

test("the first alert failure schedules attempt two 20 minutes later", () => {
  assert.deepEqual(getAdminInvitationAlertFailureState(1, NOW), {
    status: "pending",
    nextAttemptAt: new Date(NOW.getTime() + 20 * 60 * 1000),
  });
});

test("the second alert failure schedules attempt three at 60 minutes total", () => {
  const secondAttemptAt = new Date(NOW.getTime() + 20 * 60 * 1000);
  assert.deepEqual(getAdminInvitationAlertFailureState(2, secondAttemptAt), {
    status: "pending",
    nextAttemptAt: new Date(NOW.getTime() + 60 * 60 * 1000),
  });
});

test("the third alert failure is final", () => {
  assert.deepEqual(getAdminInvitationAlertFailureState(3, NOW), {
    status: "failed",
    nextAttemptAt: null,
  });
});

test("an expired reservation lease becomes eligible again", () => {
  const leaseExpiresAt = new Date(NOW.getTime() + ADMIN_INVITATION_ALERT_LEASE_MS);

  assert.equal(isAdminInvitationAlertReservationDue("processing", leaseExpiresAt, NOW), false);
  assert.equal(
    isAdminInvitationAlertReservationDue("processing", leaseExpiresAt, leaseExpiresAt),
    true,
  );
});

test("reservations use a ten-minute lease and never exceed three attempts", () => {
  assert.deepEqual(getAdminInvitationAlertReservationState(2, NOW), {
    status: "processing",
    attempts: 3,
    nextAttemptAt: new Date(NOW.getTime() + 10 * 60 * 1000),
  });
  assert.deepEqual(getAdminInvitationAlertReservationState(3, NOW), {
    status: "failed",
    attempts: 3,
    nextAttemptAt: null,
  });
  assert.throws(() => getAdminInvitationAlertReservationState(4, NOW), RangeError);
});

test("non-invitable alert roles fail without preventing later deliveries", () => {
  const plan = getAdminInvitationAlertDeliveryPlan(
    ["super_admin", "student", "super_admin_lector"],
    isAdminInvitationRole,
  );
  const sent: string[] = [];
  const failed: Array<{ status: string; nextAttemptAt: Date | null }> = [];
  const sendAlert = (role: string) => sent.push(role);

  for (const delivery of plan) {
    if (delivery.kind === "failed") {
      failed.push(getAdminInvitationAlertFailureState(3, NOW));
      continue;
    }
    sendAlert(delivery.role);
  }

  assert.deepEqual(sent, ["super_admin_lector"]);
  assert.deepEqual(failed, [
    { status: "failed", nextAttemptAt: null },
    { status: "failed", nextAttemptAt: null },
  ]);
});

test("alert outbox retention is 90 days", () => {
  assert.equal(ADMIN_INVITATION_ALERT_RETENTION_MS, 90 * 24 * 60 * 60 * 1000);
});
