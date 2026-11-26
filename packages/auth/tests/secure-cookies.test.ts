import assert from "node:assert/strict";
import test from "node:test";
import { shouldUseSecureCookies } from "../src/secure-cookies";

test("shouldUseSecureCookies is true for an https NEXTAUTH_URL", () => {
  assert.equal(shouldUseSecureCookies({ NODE_ENV: "production", NEXTAUTH_URL: "https://tablino.example" }), true);
  assert.equal(shouldUseSecureCookies({ NODE_ENV: "development", NEXTAUTH_URL: "https://tablino.example" }), true);
});

test("shouldUseSecureCookies keeps plain cookies outside production", () => {
  assert.equal(shouldUseSecureCookies({ NODE_ENV: "development", NEXTAUTH_URL: "http://tablino.example" }), false);
  assert.equal(shouldUseSecureCookies({ NODE_ENV: "test" }), false);
});

test("shouldUseSecureCookies allows local http hosts in production", () => {
  for (const url of [
    "http://localhost:3000",
    "http://127.0.0.1:3001",
    "http://[::1]:3000",
    "http://iscom.localhost:3000",
  ]) {
    assert.equal(shouldUseSecureCookies({ NODE_ENV: "production", NEXTAUTH_URL: url }), false, url);
  }
});

test("shouldUseSecureCookies refuses non-https, missing or invalid NEXTAUTH_URL in production", () => {
  for (const url of [
    "http://tablino.example",
    "http://localhost.example.com",
    "HTTPS://tablino.example",
    "not a url",
    "",
    undefined,
  ]) {
    assert.throws(
      () => shouldUseSecureCookies({ NODE_ENV: "production", NEXTAUTH_URL: url }),
      /NEXTAUTH_URL doit être en https en production\./,
      String(url),
    );
  }
});
