import assert from "node:assert/strict";
import test from "node:test";
import { SECURITY_HEADERS } from "../src/lib/security-headers.mjs";

const byKey = new Map(SECURITY_HEADERS.map(({ key, value }) => [key, value]));

test("refuses framing by any site", () => {
  assert.equal(byKey.get("X-Frame-Options"), "DENY");
  assert.equal(byKey.get("Content-Security-Policy"), "frame-ancestors 'none'");
});

test("sets nosniff, referrer policy and HSTS", () => {
  assert.equal(byKey.get("X-Content-Type-Options"), "nosniff");
  assert.equal(byKey.get("Referrer-Policy"), "strict-origin-when-cross-origin");
  assert.equal(byKey.get("Strict-Transport-Security"), "max-age=31536000; includeSubDomains");
});

test("restricts powerful browser features", () => {
  const policy = byKey.get("Permissions-Policy");
  assert.ok(policy.includes("camera=()"));
  assert.ok(policy.includes("microphone=()"));
  assert.ok(policy.includes("geolocation=()"));
});

test("has unique keys and cannot be mutated", () => {
  assert.equal(byKey.size, SECURITY_HEADERS.length);
  assert.equal(SECURITY_HEADERS.length, 6);
  assert.throws(() => { SECURITY_HEADERS.push({ key: "X", value: "y" }); });
  assert.throws(() => { SECURITY_HEADERS[0].value = "SAMEORIGIN"; });
});
