import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPaymentReturnUrl,
  createPaymentReferenceToken,
  decidePaymentConfirmation,
  describeGeniusPayFailure,
  isGeniusPayCheckoutUrl,
  isSameOriginRequest,
  parseCheckoutResponse,
  parsePaymentResponse,
  verifyPaymentReferenceToken,
} from "../src/lib/geniuspay-payment.mjs";

const userId = "11111111-1111-4111-8111-111111111111";
const universityId = "22222222-2222-4222-8222-222222222222";
const secret = "test-secret";
const now = new Date("2026-11-26T12:00:00Z");

const completed = {
  reference: "MTX-A1B2C3D4E5",
  status: "completed",
  amount: 1000,
  currency: "XOF",
  environment: "live",
  userId,
  universityId,
  plan: "premium_pro",
};

function decide(payment, overrides = {}) {
  return decidePaymentConfirmation({
    payment,
    reference: "MTX-A1B2C3D4E5",
    userId,
    universityId,
    expectedAmount: 1000,
    requireLive: true,
    ...overrides,
  });
}

test("checkout URL accepts only https://geniuspay.ci without port or credentials", () => {
  assert.equal(isGeniusPayCheckoutUrl("https://geniuspay.ci/checkout/MTX-A1B2C3D4E5"), true);
  for (const value of [
    "http://geniuspay.ci/checkout/x",
    "https://evil.example/checkout",
    "https://geniuspay.ci.evil.example/x",
    "https://geniuspay.ci:8443/x",
    "https://user:pass@geniuspay.ci/x",
    "javascript:alert(1)",
    "",
    null,
  ]) {
    assert.equal(isGeniusPayCheckoutUrl(value), false, String(value));
  }
});

test("same-origin check requires a matching Origin header", () => {
  assert.equal(isSameOriginRequest("http://iscom.localhost:3000", "iscom.localhost:3000"), true);
  assert.equal(isSameOriginRequest(null, "iscom.localhost:3000"), false);
  assert.equal(isSameOriginRequest("http://evil.localhost:3000", "iscom.localhost:3000"), false);
  assert.equal(isSameOriginRequest("null", "iscom.localhost:3000"), false);
  assert.equal(isSameOriginRequest("http://iscom.localhost:3000", null), false);
});

test("return URL is built on the university host and refuses invalid hosts", () => {
  assert.equal(buildPaymentReturnUrl("iscom.localhost:3000", false), "http://iscom.localhost:3000/paiement/retour");
  assert.equal(buildPaymentReturnUrl("ISCOM.tablino.example", true), "https://iscom.tablino.example/paiement/retour");
  for (const host of [null, "", "evil.example/path", "a b", "user@evil.example"]) {
    assert.equal(buildPaymentReturnUrl(host, true), null, String(host));
  }
});

test("checkout response yields the reference and the hosted page only", () => {
  assert.deepEqual(parseCheckoutResponse({
    success: true,
    data: { reference: "MTX-A1B2C3D4E5", checkout_url: "https://geniuspay.ci/checkout/MTX-A1B2C3D4E5" },
  }), { ok: true, reference: "MTX-A1B2C3D4E5", checkoutUrl: "https://geniuspay.ci/checkout/MTX-A1B2C3D4E5" });
  for (const body of [
    null,
    { success: false, data: {} },
    { success: true, data: { reference: "MTX-A1B2C3D4E5", checkout_url: "https://evil.example/x" } },
    { success: true, data: { reference: "bad ref", checkout_url: "https://geniuspay.ci/checkout/x" } },
  ]) {
    assert.deepEqual(parseCheckoutResponse(body), { ok: false });
  }
});

test("reference accepts underscores but never a dot (cookie token separator)", () => {
  const reference = "MTX_SANDBOX_A1B2C3D4E5F6";
  assert.deepEqual(parseCheckoutResponse({
    success: true,
    data: { reference, checkout_url: "https://geniuspay.ci/checkout/" + reference },
  }), { ok: true, reference, checkoutUrl: "https://geniuspay.ci/checkout/" + reference });
  const token = createPaymentReferenceToken({ reference, userId, now, secret });
  assert.equal(verifyPaymentReferenceToken(token, { userId, now, secret }), reference);
  assert.deepEqual(parseCheckoutResponse({
    success: true,
    data: { reference: "MTX.A1B2C3", checkout_url: "https://geniuspay.ci/checkout/x" },
  }), { ok: false });
  assert.equal(createPaymentReferenceToken({ reference: "MTX.A1B2C3", userId, now, secret }), null);
});

test("failure diagnostic gives shapes only, never the reference or customer values", () => {
  const diagnostic = describeGeniusPayFailure(201, {
    success: true,
    data: {
      reference: "MTX.SECRET-REF",
      checkout_url: "https://geniuspay.ci/checkout/MTX.SECRET-REF",
      customer: { email: "client@example.com" },
    },
  });
  assert.deepEqual(diagnostic, {
    status: 201,
    errorCode: null,
    fields: [],
    referenceValid: false,
    dataKeys: ["reference", "checkout_url", "customer"],
    referenceType: "string",
    referenceLength: 14,
    referenceOtherChars: ".",
    checkoutHost: "geniuspay.ci",
  });
  assert.equal(JSON.stringify(diagnostic).includes("SECRET"), false);
  assert.equal(JSON.stringify(diagnostic).includes("client@"), false);
  assert.deepEqual(describeGeniusPayFailure(422, {
    success: false,
    error: { code: "VALIDATION_ERROR", details: { amount: ["min"] } },
  }).fields, ["amount"]);
  assert.equal(describeGeniusPayFailure("network_error", null).referenceType, "undefined");
});

test("payment response keeps status, amount, environment and metadata", () => {
  const parsed = parsePaymentResponse({
    success: true,
    data: {
      reference: "MTX-A1B2C3D4E5",
      status: "completed",
      amount: 1000,
      currency: "XOF",
      environment: "sandbox",
      metadata: { user_id: userId, university_id: universityId, plan: "premium_pro" },
    },
  });
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.payment, { ...completed, environment: "sandbox" });
  const textAmount = parsePaymentResponse({ success: true, data: { reference: "MTX-A1B2C3D4E5", status: "completed", amount: "1000.00" } });
  assert.equal(textAmount.ok && textAmount.payment.amount, 1000);
  const badAmount = parsePaymentResponse({ success: true, data: { reference: "MTX-A1B2C3D4E5", status: "completed", amount: "1e3" } });
  assert.equal(badAmount.ok && Number.isNaN(badAmount.payment.amount), true);
  assert.deepEqual(parsePaymentResponse({ success: true, data: { reference: 1 } }), { ok: false });
  assert.deepEqual(parsePaymentResponse({ success: false }), { ok: false });
});

test("confirmation accepts a completed payment of the same student", () => {
  assert.deepEqual(decide(completed), { ok: true, plan: "premium_pro", amount: 1000 });
  assert.deepEqual(decide({ ...completed, environment: "sandbox" }, { requireLive: false }), { ok: true, plan: "premium_pro", amount: 1000 });
});

test("confirmation refuses every mismatch", () => {
  assert.deepEqual(decide({ ...completed, reference: "MTX-OTHER00000" }), { ok: false, reason: "reference_mismatch" });
  assert.deepEqual(decide({ ...completed, status: "pending" }), { ok: false, reason: "pending" });
  assert.deepEqual(decide({ ...completed, status: "processing" }), { ok: false, reason: "pending" });
  for (const status of ["failed", "cancelled", "expired", "refunded", "unknown"]) {
    assert.deepEqual(decide({ ...completed, status }), { ok: false, reason: "failed" }, status);
  }
  assert.deepEqual(decide({ ...completed, environment: "sandbox" }), { ok: false, reason: "environment_mismatch" });
  assert.deepEqual(decide({ ...completed, currency: "EUR" }), { ok: false, reason: "currency_mismatch" });
  assert.deepEqual(decide({ ...completed, userId: "33333333-3333-4333-8333-333333333333" }), { ok: false, reason: "owner_mismatch" });
  assert.deepEqual(decide({ ...completed, universityId: null }), { ok: false, reason: "owner_mismatch" });
  assert.deepEqual(decide({ ...completed, amount: 999 }), { ok: false, reason: "amount_mismatch" });
  assert.deepEqual(decide({ ...completed, amount: Number.NaN }), { ok: false, reason: "amount_mismatch" });
});

test("reference token round-trips for the same student before expiry", () => {
  const token = createPaymentReferenceToken({ reference: "MTX-A1B2C3D4E5", userId, now, secret });
  assert.equal(typeof token, "string");
  assert.equal(verifyPaymentReferenceToken(token, { userId, now, secret }), "MTX-A1B2C3D4E5");
  assert.equal(verifyPaymentReferenceToken(token, { userId, now: new Date(now.getTime() + 1799_000), secret }), "MTX-A1B2C3D4E5");
});

test("reference token is refused when expired, tampered, for another student or another secret", () => {
  const token = createPaymentReferenceToken({ reference: "MTX-A1B2C3D4E5", userId, now, secret });
  assert.equal(verifyPaymentReferenceToken(token, { userId, now: new Date(now.getTime() + 1800_000), secret }), null);
  assert.equal(verifyPaymentReferenceToken(token, { userId: "33333333-3333-4333-8333-333333333333", now, secret }), null);
  assert.equal(verifyPaymentReferenceToken(token, { userId, now, secret: "other" }), null);
  assert.equal(verifyPaymentReferenceToken(token.replace("MTX-A1B2C3D4E5", "MTX-ZZZZZZZZZZ"), { userId, now, secret }), null);
  for (const value of [undefined, "", "a.b.c", token + ".x"]) {
    assert.equal(verifyPaymentReferenceToken(value, { userId, now, secret }), null, String(value));
  }
});

test("reference token is not created without a secret or with invalid inputs", () => {
  assert.equal(createPaymentReferenceToken({ reference: "MTX-A1B2C3D4E5", userId, now, secret: "" }), null);
  assert.equal(createPaymentReferenceToken({ reference: "MTX-A1B2C3D4E5", userId, now, secret: undefined }), null);
  assert.equal(createPaymentReferenceToken({ reference: "bad.ref", userId, now, secret }), null);
  assert.equal(createPaymentReferenceToken({ reference: "MTX-A1B2C3D4E5", userId: "not-a-uuid", now, secret }), null);
});
