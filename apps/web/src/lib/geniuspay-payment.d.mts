export const GENIUSPAY_API_BASE: string;
export const GENIUSPAY_PROVIDER: string;
export const PAYMENT_REFERENCE_TTL_SECONDS: number;

export type GeniusPayPayment = {
  reference: string;
  status: string;
  amount: number;
  currency: string | null;
  environment: string | null;
  userId: string | null;
  universityId: string | null;
  plan: string | null;
};

export type PaymentConfirmation =
  | { ok: true; plan: string | null; amount: number }
  | {
    ok: false;
    reason:
      | "reference_mismatch"
      | "pending"
      | "failed"
      | "environment_mismatch"
      | "currency_mismatch"
      | "owner_mismatch"
      | "amount_mismatch";
  };

export function isPaymentReference(value: unknown): value is string;
export function isGeniusPayCheckoutUrl(value: unknown): value is string;
export function isSameOriginRequest(origin: string | null, host: string | null): boolean;
export function buildPaymentReturnUrl(host: string | null, secure: boolean): string | null;
export function describeGeniusPayFailure(status: number | string, body: unknown): {
  status: number | string;
  errorCode: string | null;
  fields: string[];
  referenceValid: boolean;
  dataKeys: string[];
  referenceType: string;
  referenceLength: number | null;
  referenceOtherChars: string | null;
  checkoutHost: string | null;
};
export function parseCheckoutResponse(body: unknown): { ok: true; reference: string; checkoutUrl: string } | { ok: false };
export function parsePaymentResponse(body: unknown): { ok: true; payment: GeniusPayPayment } | { ok: false };
export function decidePaymentConfirmation(input: {
  payment: GeniusPayPayment;
  reference: string;
  userId: string;
  universityId: string;
  expectedAmount: number;
  requireLive: boolean;
}): PaymentConfirmation;
export const WEBHOOK_TOLERANCE_SECONDS: number;
export const WEBHOOK_MAX_BYTES: number;
export function verifyWebhookSignature(input: {
  rawBody: string;
  signature: string | null;
  timestamp: string | null;
  secret: string | undefined;
  now: Date;
}):
  | { ok: true; payload: Record<string, unknown> }
  | { ok: false; reason: "missing_secret" | "invalid_signature" | "stale_timestamp" | "invalid_body" };
export function parseWebhookEvent(payload: unknown): { event: string | null; reference: string | null };
export function createPaymentReferenceToken(input: {
  reference: string;
  userId: string;
  now: Date;
  secret: string | undefined;
}): string | null;
export function verifyPaymentReferenceToken(
  token: string | undefined,
  input: { userId: string; now: Date; secret: string | undefined },
): string | null;
