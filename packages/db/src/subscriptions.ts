import { and, eq } from "drizzle-orm";
import type { db as sharedDb } from "./client";
import * as schema from "./schema";
import {
  computePaidPeriod,
  computeRevenueShare,
  computeTrialEnd,
  isPlanValid,
  PLAN_CONFIG,
  type Plan,
} from "./plans";

type SubscriptionDatabase = typeof sharedDb;

async function resolveDatabase(database?: SubscriptionDatabase): Promise<SubscriptionDatabase> {
  return database ?? (await import("./client")).db;
}

export type StartTrialResult =
  | { ok: true; trialEndsAt: Date }
  | { ok: false; reason: "not_found" | "revoked" | "trial_already_used" | "already_subscribed" };

export async function startTrial(
  universityId: string,
  userId: string,
  database?: SubscriptionDatabase,
  now = new Date(),
): Promise<StartTrialResult> {
  return (await resolveDatabase(database)).transaction(async (tx) => {
    const users = await tx
      .select({
        id: schema.users.id,
        role: schema.users.role,
        revokedAt: schema.users.revokedAt,
        trialStartedAt: schema.users.trialStartedAt,
        currentPlan: schema.users.currentPlan,
      })
      .from(schema.users)
      .where(and(
        eq(schema.users.id, userId),
        eq(schema.users.universityId, universityId),
      ))
      .for("update")
      .limit(1);
    if (!(users.length > 0) || users[0].role !== "student") {
      return { ok: false, reason: "not_found" };
    }
    if (users[0].revokedAt !== null) return { ok: false, reason: "revoked" };
    if (users[0].trialStartedAt !== null) {
      return { ok: false, reason: "trial_already_used" };
    }
    if (users[0].currentPlan !== null) {
      return { ok: false, reason: "already_subscribed" };
    }

    const trialEndsAt = computeTrialEnd(now);
    await tx
      .update(schema.users)
      .set({ trialStartedAt: now, trialEndsAt })
      .where(and(
        eq(schema.users.id, userId),
        eq(schema.users.universityId, universityId),
      ));

    return { ok: true, trialEndsAt };
  });
}

export type RecordVerifiedPaymentInput = {
  universityId: string;
  userId: string;
  plan: unknown;
  provider: string;
  transactionId: string;
  amountXof: number;
};

export type RecordVerifiedPaymentResult =
  | {
    ok: true;
    duplicate: false;
    periodStart: Date;
    periodEnd: Date;
    universityAmount: number;
    platformAmount: number;
  }
  | { ok: true; duplicate: true }
  | {
    ok: false;
    reason:
      | "invalid_plan"
      | "amount_mismatch"
      | "not_found"
      | "revoked"
      | "university_not_found"
      | "invalid_share"
      | "transaction_conflict";
  };

export async function recordVerifiedPayment(
  input: RecordVerifiedPaymentInput,
  database?: SubscriptionDatabase,
  now = new Date(),
): Promise<RecordVerifiedPaymentResult> {
  if (!isPlanValid(input.plan)) return { ok: false, reason: "invalid_plan" };
  const plan: Plan = input.plan;
  if (input.amountXof !== PLAN_CONFIG[plan].priceXof) {
    return { ok: false, reason: "amount_mismatch" };
  }

  return (await resolveDatabase(database)).transaction(async (tx) => {
    const users = await tx
      .select({
        id: schema.users.id,
        role: schema.users.role,
        revokedAt: schema.users.revokedAt,
        subscriptionExpiresAt: schema.users.subscriptionExpiresAt,
        trialEndsAt: schema.users.trialEndsAt,
      })
      .from(schema.users)
      .where(and(
        eq(schema.users.id, input.userId),
        eq(schema.users.universityId, input.universityId),
      ))
      .for("update")
      .limit(1);
    if (!(users.length > 0) || users[0].role !== "student") {
      return { ok: false, reason: "not_found" };
    }
    if (users[0].revokedAt !== null) return { ok: false, reason: "revoked" };

    const universities = await tx
      .select({ revenueShareBps: schema.universities.revenueShareBps })
      .from(schema.universities)
      .where(eq(schema.universities.id, input.universityId))
      .limit(1);
    if (!(universities.length > 0)) {
      return { ok: false, reason: "university_not_found" };
    }

    const revenueShare = computeRevenueShare(input.amountXof, universities[0].revenueShareBps);
    if (!revenueShare.ok) return { ok: false, reason: "invalid_share" };

    const subscriptionExpiresAt = users[0].subscriptionExpiresAt;
    const trialEndsAt = users[0].trialEndsAt;
    const accessUntil = subscriptionExpiresAt !== null && trialEndsAt !== null
      ? subscriptionExpiresAt.getTime() >= trialEndsAt.getTime()
        ? subscriptionExpiresAt
        : trialEndsAt
      : subscriptionExpiresAt ?? trialEndsAt;
    const { periodStart, periodEnd } = computePaidPeriod(accessUntil, now, plan);
    const inserted = await tx
      .insert(schema.subscriptions)
      .values({
        userId: input.userId,
        provider: input.provider,
        transactionId: input.transactionId,
        amount: input.amountXof,
        status: "paid",
        periodStart,
        periodEnd,
        webhookVerified: true,
        plan,
        universityId: input.universityId,
        shareBps: universities[0].revenueShareBps,
        universityAmount: revenueShare.universityAmount,
        platformAmount: revenueShare.platformAmount,
      })
      .onConflictDoNothing({ target: schema.subscriptions.transactionId })
      .returning({ id: schema.subscriptions.id });

    if (inserted.length > 0) {
      await tx
        .update(schema.users)
        .set({ subscriptionExpiresAt: periodEnd, currentPlan: plan })
        .where(and(
          eq(schema.users.id, input.userId),
          eq(schema.users.universityId, input.universityId),
        ));

      return {
        ok: true,
        duplicate: false,
        periodStart,
        periodEnd,
        universityAmount: revenueShare.universityAmount,
        platformAmount: revenueShare.platformAmount,
      };
    }

    const existingSubscriptions = await tx
      .select({
        userId: schema.subscriptions.userId,
        amount: schema.subscriptions.amount,
      })
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.transactionId, input.transactionId))
      .limit(1);
    if (
      existingSubscriptions.length > 0
      && existingSubscriptions[0].userId === input.userId
      && existingSubscriptions[0].amount === input.amountXof
    ) {
      return { ok: true, duplicate: true };
    }

    return { ok: false, reason: "transaction_conflict" };
  });
}
