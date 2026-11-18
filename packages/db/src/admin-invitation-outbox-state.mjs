export const ADMIN_INVITATION_ALERT_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
export const ADMIN_INVITATION_ALERT_LEASE_MS = 10 * 60 * 1000;
export const ADMIN_INVITATION_ALERT_RETRY_DELAYS_MS = Object.freeze([
  20 * 60 * 1000,
  40 * 60 * 1000,
]);

export function isAdminInvitationAlertReservationDue(status, nextAttemptAt, now) {
  return (status === "pending" || status === "processing")
    && nextAttemptAt.getTime() <= now.getTime();
}

export function getAdminInvitationAlertDeliveryDisposition(role, isInvitableRole) {
  return isInvitableRole(role)
    ? { kind: "send", role }
    : { kind: "failed" };
}

export function getAdminInvitationAlertDeliveryPlan(roles, isInvitableRole) {
  return roles.map((role) => getAdminInvitationAlertDeliveryDisposition(role, isInvitableRole));
}

export function getAdminInvitationAlertReservationState(attempts, now) {
  if (!Number.isInteger(attempts) || attempts < 0 || attempts > 3) {
    throw new RangeError("Nombre de réservations d’alerte invalide.");
  }
  if (attempts === 3) {
    return { status: "failed", attempts, nextAttemptAt: null };
  }
  return {
    status: "processing",
    attempts: attempts + 1,
    nextAttemptAt: new Date(now.getTime() + ADMIN_INVITATION_ALERT_LEASE_MS),
  };
}

export function getAdminInvitationAlertFailureState(attempts, now) {
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 3) {
    throw new RangeError("Nombre de tentatives d’alerte invalide.");
  }
  if (attempts === 3) {
    return { status: "failed", nextAttemptAt: null };
  }
  return {
    status: "pending",
    nextAttemptAt: new Date(
      now.getTime() + ADMIN_INVITATION_ALERT_RETRY_DELAYS_MS[attempts - 1],
    ),
  };
}
