import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
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
  parseWebhookEvent,
  readLimitedText,
  verifyPaymentReferenceToken,
  verifyWebhookSignature,
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

function streamOf(chunks) {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

test("limited body reader returns UTF-8 text up to the limit, even split mid-character", async () => {
  const bytes = Buffer.from("café", "utf8");
  assert.equal(await readLimitedText(streamOf([bytes.subarray(0, 4), bytes.subarray(4)]), 5), "café");
  assert.equal(await readLimitedText(streamOf([Buffer.from("abc")]), 3), "abc");
  assert.equal(await readLimitedText(null, 10), "");
  assert.equal(await readLimitedText(streamOf([]), 10), "");
});

test("limited body reader stops and returns null past the limit", async () => {
  let pulled = 0;
  const endless = new ReadableStream({
    pull(controller) {
      pulled += 1;
      controller.enqueue(Buffer.alloc(1024));
    },
  });
  assert.equal(await readLimitedText(endless, 4096), null);
  assert.ok(pulled <= 6, String(pulled));
  assert.equal(await readLimitedText(streamOf([Buffer.from("abcd")]), 3), null);
});

const webhookSecret = "whsec_test";
const webhookTimestamp = String(Math.floor(now.getTime() / 1000));
function webhookSign(body, timestamp = webhookTimestamp, key = webhookSecret) {
  return createHmac("sha256", key).update(timestamp + "." + body).digest("hex");
}
const webhookBody = JSON.stringify({
  event: "payment.success",
  data: { reference: "SANDBOX_A1B2C3D4E5", metadata: { note: "a/b é" } },
});
function verifyWebhook(overrides = {}) {
  return verifyWebhookSignature({
    rawBody: webhookBody,
    signature: webhookSign(webhookBody),
    timestamp: webhookTimestamp,
    secret: webhookSecret,
    now,
    ...overrides,
  });
}

test("webhook signature over the raw body is accepted (hex, any case)", () => {
  const result = verifyWebhook();
  assert.equal(result.ok, true);
  assert.equal(result.payload.event, "payment.success");
  assert.equal(verifyWebhook({ signature: webhookSign(webhookBody).toUpperCase() }).ok, true);
});

test("webhook signature over the PHP-style JSON is accepted", () => {
  const phpBody = webhookBody.replace(/\//g, "\\/").replace(String.fromCharCode(0xe9), "\\" + "u00e9");
  assert.notEqual(phpBody, webhookBody);
  assert.equal(verifyWebhook({ signature: webhookSign(phpBody) }).ok, true);
});

test("webhook refuses a wrong secret, a tampered body or a malformed signature", () => {
  assert.deepEqual(verifyWebhook({ signature: webhookSign(webhookBody, webhookTimestamp, "other") }), { ok: false, reason: "invalid_signature" });
  assert.deepEqual(verifyWebhook({ rawBody: webhookBody.replace("SANDBOX", "SANDBOY") }), { ok: false, reason: "invalid_signature" });
  for (const signature of [null, "", "abc", "z".repeat(64), "sha256=" + webhookSign(webhookBody)]) {
    assert.deepEqual(verifyWebhook({ signature }), { ok: false, reason: "invalid_signature" }, String(signature));
  }
  for (const timestamp of [null, "", "12a", "-1", "1".repeat(13)]) {
    assert.deepEqual(verifyWebhook({ timestamp }), { ok: false, reason: "invalid_signature" }, String(timestamp));
  }
  // Signature d'un autre horodatage : la donnée signée inclut l'horodatage.
  assert.deepEqual(verifyWebhook({ timestamp: String(Number(webhookTimestamp) + 1) }), { ok: false, reason: "invalid_signature" });
});

test("webhook refuses a missing secret, a stale timestamp and a non-object body", () => {
  assert.deepEqual(verifyWebhook({ secret: undefined }), { ok: false, reason: "missing_secret" });
  assert.deepEqual(verifyWebhook({ secret: "" }), { ok: false, reason: "missing_secret" });
  for (const delta of [301, -301]) {
    const timestamp = String(Number(webhookTimestamp) + delta);
    assert.deepEqual(verifyWebhook({ timestamp, signature: webhookSign(webhookBody, timestamp) }), { ok: false, reason: "stale_timestamp" }, String(delta));
  }
  for (const delta of [300, -300]) {
    const timestamp = String(Number(webhookTimestamp) + delta);
    assert.equal(verifyWebhook({ timestamp, signature: webhookSign(webhookBody, timestamp) }).ok, true, String(delta));
  }
  for (const rawBody of ["not json", "[1,2]", "null", "\"x\""]) {
    assert.deepEqual(verifyWebhook({ rawBody, signature: webhookSign(rawBody) }), { ok: false, reason: "invalid_body" }, rawBody);
  }
});

test("webhook event yields the type and a valid reference only", () => {
  assert.deepEqual(parseWebhookEvent({ event: "payment.success", data: { reference: "SANDBOX_A1B2C3D4E5" } }), { event: "payment.success", reference: "SANDBOX_A1B2C3D4E5" });
  assert.deepEqual(parseWebhookEvent({ event: "payment.success", data: { reference: "bad.ref" } }), { event: "payment.success", reference: null });
  assert.deepEqual(parseWebhookEvent({ event: 3 }), { event: null, reference: null });
  assert.deepEqual(parseWebhookEvent(null), { event: null, reference: null });
});
