export type AccessStatus =
  | { kind: "revoked" }
  | { kind: "pro"; endsAt: Date }
  | { kind: "trial"; endsAt: Date; daysLeft: number }
  | { kind: "expired"; endedAt: Date }
  | { kind: "none" };

export function describeAccessStatus(
  user: { revokedAt: Date | null; trialEndsAt: Date | null; subscriptionExpiresAt: Date | null },
  now: Date,
): AccessStatus;
export function accessStatusLabel(status: AccessStatus): string | null;
export function accessStatusSpokenLabel(status: AccessStatus): string | null;
export function formatAccessDate(date: Date): string;
