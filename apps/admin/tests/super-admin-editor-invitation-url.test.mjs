import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSuperAdminEditorInvitationUrl,
  normalizeAdminRootDomain,
} from "../src/lib/super-admin-editor-invitation.mjs";

const TOKEN = Buffer.alloc(32, 7).toString("base64url");

test("trims the root domain and builds an HTTPS invitation URL", () => {
  const result = buildSuperAdminEditorInvitationUrl(`  example.com  `, TOKEN, true);
  const url = new URL(result);

  assert.equal(url.origin, "https://sup-admin.example.com");
  assert.equal(url.pathname, "/admin-invitation/start");
  assert.equal(url.searchParams.get("token"), TOKEN);
});

test("uses HTTP for a local root domain", () => {
  assert.equal(
    new URL(buildSuperAdminEditorInvitationUrl("localhost:3001", TOKEN, false)).origin,
    "http://sup-admin.localhost:3001",
  );
});

test("accepts hostnames and ports but rejects schemes, paths, spaces, and empty values", () => {
  assert.equal(normalizeAdminRootDomain("localhost:3001"), "localhost:3001");
  assert.equal(normalizeAdminRootDomain("example.test"), "example.test");
  assert.equal(normalizeAdminRootDomain("admin.tablino.com"), "admin.tablino.com");
  assert.equal(normalizeAdminRootDomain("https://admin.tablino.com"), null);
  assert.equal(normalizeAdminRootDomain("admin.tablino.com/path"), null);
  assert.equal(normalizeAdminRootDomain("admin .tablino.com"), null);
  assert.equal(normalizeAdminRootDomain(""), null);
});

test("rejects a missing root domain", () => {
  assert.equal(normalizeAdminRootDomain("   "), null);
  assert.equal(buildSuperAdminEditorInvitationUrl("", TOKEN, true), null);
});

test("rejects root-domain values that can alter the destination host", () => {
  assert.equal(normalizeAdminRootDomain("example.com/attacker"), null);
  assert.equal(normalizeAdminRootDomain("example.com@evil.test"), null);
  assert.equal(buildSuperAdminEditorInvitationUrl("example.com", "bad-token", true), null);
});
