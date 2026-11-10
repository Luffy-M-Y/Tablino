import assert from "node:assert/strict";
import test from "node:test";
import { getReturnCode, resolveReturnDecision } from "../src/lib/auth-central-return.mjs";

// NOTE : le flux réel Google, les cookies navigateur, la consommation
// en base et les redirections ne sont pas testés ici. Seules les fonctions
// pures getReturnCode et resolveReturnDecision sont testées.

// ─── getReturnCode ─────────────────────────────────────────────────────────────

test("getReturnCode extracts the code from valid query params", () => {
  const params = new URLSearchParams();
  params.set("code", "abc123");
  assert.equal(getReturnCode(params), "abc123");
});

test("getReturnCode returns null for missing code", () => {
  const params = new URLSearchParams();
  assert.equal(getReturnCode(params), null);
});

test("getReturnCode returns null for empty code", () => {
  const params = new URLSearchParams();
  params.set("code", "");
  assert.equal(getReturnCode(params), null);
});

test("getReturnCode returns null for non-URLSearchParams input", () => {
  assert.equal(getReturnCode(null), null);
  assert.equal(getReturnCode("code=abc"), null);
  assert.equal(getReturnCode({ code: "abc" }), null);
});

// ─── resolveReturnDecision ─────────────────────────────────────────────────────

test("resolveReturnDecision redirects to /connexion when the code is absent", () => {
  assert.deepEqual(
    resolveReturnDecision({ code: null, universityId: "u1", consumeResult: { userId: "user-1" } }),
    { action: "redirect", path: "/connexion" },
  );
});

test("resolveReturnDecision redirects to /connexion when the university is null", () => {
  assert.deepEqual(
    resolveReturnDecision({ code: "abc", universityId: null, consumeResult: { userId: "user-1" } }),
    { action: "redirect", path: "/connexion" },
  );
});

test("resolveReturnDecision redirects to /connexion when consumption fails", () => {
  assert.deepEqual(
    resolveReturnDecision({ code: "abc", universityId: "u1", consumeResult: null }),
    { action: "redirect", path: "/connexion" },
  );
});

test("resolveReturnDecision creates a session when consumption succeeds", () => {
  assert.deepEqual(
    resolveReturnDecision({ code: "abc", universityId: "u1", consumeResult: { userId: "user-1" } }),
    { action: "session", userId: "user-1" },
  );
});
