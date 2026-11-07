import assert from "node:assert/strict";
import test from "node:test";
import { getCloudflareClientIp } from "../src/client-ip";

test("getCloudflareClientIp reads a valid Cloudflare IPv4 address", () => {
  const headers = new Headers({ "cf-connecting-ip": "203.0.113.10" });
  assert.equal(getCloudflareClientIp(headers), "203.0.113.10");
});

test("getCloudflareClientIp accepts IPv6 and normalizes its case", () => {
  const headers = new Headers({ "cf-connecting-ip": "2001:DB8::1" });
  assert.equal(getCloudflareClientIp(headers), "2001:db8::1");
});

test("getCloudflareClientIp rejects missing, malformed, and forwarded-list values", () => {
  assert.equal(getCloudflareClientIp(new Headers()), null);
  assert.equal(
    getCloudflareClientIp(new Headers({ "cf-connecting-ip": "not-an-ip" })),
    null,
  );
  assert.equal(
    getCloudflareClientIp(new Headers({ "cf-connecting-ip": "203.0.113.10, 198.51.100.2" })),
    null,
  );
});
