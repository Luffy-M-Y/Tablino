import assert from "node:assert/strict";
import test from "node:test";
import { buildContentSecurityPolicy, buildSecurityHeaders, SECURITY_HEADERS } from "../src/lib/security-headers.mjs";

const byKey = new Map(SECURITY_HEADERS.map(({ key, value }) => [key, value]));

function directives(policy) {
  return new Map(policy.split("; ").map((part) => {
    const index = part.indexOf(" ");
    return [part.slice(0, index), part.slice(index + 1)];
  }));
}

test("refuses framing by any site", () => {
  assert.equal(byKey.get("X-Frame-Options"), "DENY");
  assert.equal(directives(byKey.get("Content-Security-Policy")).get("frame-ancestors"), "'none'");
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

test("production CSP allows only the expected sources", () => {
  const policy = directives(buildContentSecurityPolicy({ development: false }));
  assert.deepEqual([...policy.entries()], [
    ["default-src", "'self'"],
    ["script-src", "'self' 'unsafe-inline' https://challenges.cloudflare.com"],
    ["style-src", "'self' 'unsafe-inline'"],
    ["img-src", "'self' data: blob:"],
    ["font-src", "'self'"],
    ["connect-src", "'self' https://*.r2.cloudflarestorage.com"],
    ["frame-src", "https://challenges.cloudflare.com"],
    ["object-src", "'none'"],
    ["base-uri", "'self'"],
    ["form-action", "'self' https://accounts.google.com https://geniuspay.ci"],
    ["frame-ancestors", "'none'"],
  ]);
  assert.equal(byKey.get("Content-Security-Policy"), buildContentSecurityPolicy({ development: false }));
});

test("production CSP never allows eval nor a bare wildcard", () => {
  const policy = buildContentSecurityPolicy({ development: false });
  assert.equal(policy.includes("'unsafe-eval'"), false);
  for (const sources of directives(policy).values()) {
    assert.equal(sources.split(" ").includes("*"), false, sources);
  }
});

test("development CSP only adds unsafe-eval to scripts", () => {
  const production = directives(buildContentSecurityPolicy({ development: false }));
  const development = directives(buildContentSecurityPolicy({ development: true }));
  assert.equal(development.get("script-src"), production.get("script-src") + " 'unsafe-eval'");
  assert.equal(development.size, production.size);
  for (const [name, sources] of production) {
    if (name !== "script-src") assert.equal(development.get(name), sources, name);
  }
  const headers = new Map(buildSecurityHeaders({ development: true }).map(({ key, value }) => [key, value]));
  assert.equal(headers.get("Content-Security-Policy"), buildContentSecurityPolicy({ development: true }));
  assert.equal(headers.get("X-Frame-Options"), "DENY");
});

test("form-action adds the central sign-in host when configured", () => {
  const withHost = directives(buildContentSecurityPolicy({ development: false, centralHost: " Auth.Example.com:8443 " }));
  assert.equal(withHost.get("form-action"), "'self' https://accounts.google.com https://geniuspay.ci auth.example.com:8443");
  const without = directives(buildContentSecurityPolicy({ development: false }));
  assert.equal(without.get("form-action"), "'self' https://accounts.google.com https://geniuspay.ci");
  assert.equal(directives(buildContentSecurityPolicy({ development: false, centralHost: "  " })).get("form-action"), without.get("form-action"));
  const headers = new Map(buildSecurityHeaders({ development: false, centralHost: "127.0.0.1:3001" }).map(({ key, value }) => [key, value]));
  assert.equal(directives(headers.get("Content-Security-Policy")).get("form-action"), "'self' https://accounts.google.com https://geniuspay.ci 127.0.0.1:3001");
});

test("refuses an invalid central host instead of writing a wrong policy", () => {
  for (const value of ["https://auth.example.com", "auth.example.com/path", "auth.example.com; script-src *", "a b", "*.example.com", "-auth.example.com", "auth.example.com:"]) {
    assert.throws(() => buildContentSecurityPolicy({ development: false, centralHost: value }), /invalide pour la CSP/, value);
  }
});
