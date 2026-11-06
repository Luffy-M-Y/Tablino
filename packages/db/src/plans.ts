export type Plan = "premium_pro" | "premium_pro_max";

export const PLANS: Plan[] = ["premium_pro", "premium_pro_max"];
export const TRIAL_DAYS = 30;

// Prix FICTIFS, à remplacer.
export const PLAN_CONFIG: Record<Plan, {
  priceXof: number;
  durationDays: number;
  offlineDownload: boolean;
}> = {
  premium_pro: {
    priceXof: 1000,
    durationDays: 30,
    offlineDownload: false,
  },
  premium_pro_max: {
    priceXof: 2500,
    durationDays: 30,
    offlineDownload: true,
  },
};

export type AccessState = "none" | "trial" | "paid" | "expired";

export function isPlanValid(value: unknown): value is Plan {
  return PLANS.some((plan) => plan === value);
}

export function computeTrialEnd(start: Date): Date {
  return new Date(start.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
}

export function computeRevenueShare(
  amountXof: number,
  shareBps: number,
): { ok: true; universityAmount: number; platformAmount: number }
  | { ok: false; reason: "invalid_amount" | "invalid_share" } {
  if (!Number.isInteger(amountXof) || amountXof <= 0) {
    return { ok: false, reason: "invalid_amount" };
  }
  if (!Number.isInteger(shareBps) || shareBps < 0 || shareBps > 10000) {
    return { ok: false, reason: "invalid_share" };
  }

  const universityAmount = Math.floor(amountXof * shareBps / 10000);
  return {
    ok: true,
    universityAmount,
    platformAmount: amountXof - universityAmount,
  };
}

export function computePaidPeriod(
  accessUntil: Date | null,
  now: Date,
  plan: Plan,
): { periodStart: Date; periodEnd: Date } {
  const periodStart = accessUntil !== null && accessUntil.getTime() > now.getTime()
    ? accessUntil
    : now;
  const periodEnd = new Date(
    periodStart.getTime() + PLAN_CONFIG[plan].durationDays * 24 * 60 * 60 * 1000,
  );
  return { periodStart, periodEnd };
}

export function getAccessState(
  row: { trialEndsAt: Date | null; paidUntil: Date | null },
  now: Date,
): AccessState {
  if (row.paidUntil !== null && row.paidUntil.getTime() > now.getTime()) return "paid";
  if (row.trialEndsAt !== null && row.trialEndsAt.getTime() > now.getTime()) return "trial";
  if (row.paidUntil !== null || row.trialEndsAt !== null) return "expired";
  return "none";
}

export function hasAccess(state: AccessState): boolean {
  return state === "trial" || state === "paid";
}

export function canDownload(plan: Plan | null, state: AccessState): boolean {
  return state === "paid" && plan !== null && PLAN_CONFIG[plan].offlineDownload;
}
