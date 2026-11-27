import { PLAN_CONFIG, recordVerifiedPayment, type Plan } from "@tablino/db";
import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { fetchGeniusPayPayment } from "@/lib/geniuspay";
import {
  decidePaymentConfirmation,
  GENIUSPAY_PROVIDER,
  parseWebhookEvent,
  readLimitedText,
  verifyWebhookSignature,
  WEBHOOK_MAX_BYTES,
} from "@/lib/geniuspay-payment.mjs";

const NO_STORE = { "Cache-Control": "no-store" } as const;
const PLAN: Plan = "premium_pro";

function reply(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

function log(code: string, extra: Record<string, unknown> = {}) {
  console.warn(JSON.stringify({ code, provider: GENIUSPAY_PROVIDER, ...extra }));
}

// Webhook GeniusPay (serveur à serveur) : signature et fenêtre de 5 minutes obligatoires,
// puis le paiement est relu chez GeniusPay ; le contenu du message n'est jamais cru.
export async function POST(request: NextRequest) {
  const secret = process.env.GENIUSPAY_WEBHOOK_SECRET?.trim();
  if (!secret) {
    log("payment_webhook_missing_secret");
    return reply(503, { error: "unavailable" });
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > WEBHOOK_MAX_BYTES) return reply(413, { error: "too_large" });
  // Lecture en flux coupée à 64 Ko, même sans Content-Length (envoi par morceaux).
  const rawBody = await readLimitedText(request.body, WEBHOOK_MAX_BYTES);
  if (rawBody === null) return reply(413, { error: "too_large" });

  const verified = verifyWebhookSignature({
    rawBody,
    signature: request.headers.get("x-webhook-signature"),
    timestamp: request.headers.get("x-webhook-timestamp"),
    secret,
    now: new Date(),
  });
  if (!verified.ok) {
    log("payment_webhook_refused", { reason: verified.reason });
    if (verified.reason === "invalid_signature") return reply(401, { error: "invalid_signature" });
    if (verified.reason === "missing_secret") return reply(503, { error: "unavailable" });
    return reply(400, { error: verified.reason });
  }

  const { event, reference } = parseWebhookEvent(verified.payload);
  // Seul le paiement réussi est traité ; les autres événements (test compris) sont seulement acquittés.
  if (event !== "payment.success") return reply(200, { received: true });
  if (reference === null) {
    log("payment_webhook_refused", { reason: "invalid_reference" });
    return reply(400, { error: "invalid_reference" });
  }

  const fetched = await fetchGeniusPayPayment(reference);
  // GeniusPay injoignable : 503 pour que GeniusPay renvoie le webhook plus tard.
  if (!fetched.ok) return reply(503, { error: "unavailable" });

  const { payment } = fetched;
  if (payment.userId === null || payment.universityId === null) {
    log("payment_webhook_ignored", { reason: "missing_metadata" });
    return reply(200, { received: true });
  }
  const decision = decidePaymentConfirmation({
    payment,
    reference,
    userId: payment.userId,
    universityId: payment.universityId,
    expectedAmount: PLAN_CONFIG[PLAN].priceXof,
    requireLive: process.env.NODE_ENV === "production",
  });
  if (!decision.ok) {
    if (decision.reason === "pending") return reply(503, { error: "pending" });
    log("payment_webhook_ignored", { reason: decision.reason });
    return reply(200, { received: true });
  }

  const recorded = await recordVerifiedPayment({
    universityId: payment.universityId,
    userId: payment.userId,
    plan: decision.plan,
    provider: GENIUSPAY_PROVIDER,
    transactionId: reference,
    amountXof: decision.amount,
  });
  if (!recorded.ok) {
    log("payment_webhook_record_refused", { reason: recorded.reason });
    return reply(200, { received: true });
  }

  revalidatePath("/", "layout");
  return reply(200, { received: true });
}
