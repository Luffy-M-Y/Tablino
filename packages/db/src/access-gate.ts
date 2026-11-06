import { getAccessState, hasAccess } from "./plans";

export type StudentAccessDecision = "revoked" | "allowed" | "subscription_required";

export function decideStudentAccess(
  row: {
    revokedAt: Date | null;
    trialEndsAt: Date | null;
    subscriptionExpiresAt: Date | null;
  },
  now: Date,
): StudentAccessDecision {
  if (row.revokedAt !== null) return "revoked";
  const state = getAccessState({
    trialEndsAt: row.trialEndsAt,
    paidUntil: row.subscriptionExpiresAt,
  }, now);
  return hasAccess(state) ? "allowed" : "subscription_required";
}
