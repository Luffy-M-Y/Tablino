export const ADMIN_INVITATION_ALERT_RETENTION_MS: number;
export const ADMIN_INVITATION_ALERT_LEASE_MS: number;
export const ADMIN_INVITATION_ALERT_RETRY_DELAYS_MS: readonly number[];

export function isAdminInvitationAlertReservationDue(
  status: string,
  nextAttemptAt: Date,
  now: Date,
): boolean;

type AdminInvitationAlertRole = "super_admin_editor" | "super_admin_lector";

export function getAdminInvitationAlertDeliveryDisposition(
  role: unknown,
  isInvitableRole: (role: unknown) => role is AdminInvitationAlertRole,
):
  | { kind: "send"; role: AdminInvitationAlertRole }
  | { kind: "failed" };

export function getAdminInvitationAlertDeliveryPlan(
  roles: readonly unknown[],
  isInvitableRole: (role: unknown) => role is AdminInvitationAlertRole,
): Array<
  | { kind: "send"; role: AdminInvitationAlertRole }
  | { kind: "failed" }
>;

export function getAdminInvitationAlertReservationState(
  attempts: number,
  now: Date,
):
  | { status: "processing"; attempts: number; nextAttemptAt: Date }
  | { status: "failed"; attempts: number; nextAttemptAt: null };

export function getAdminInvitationAlertFailureState(
  attempts: number,
  now: Date,
):
  | { status: "pending"; nextAttemptAt: Date }
  | { status: "failed"; nextAttemptAt: null };
