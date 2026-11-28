import assert from "node:assert/strict";
import test from "node:test";
import {
  getAdmin2faMessage,
  normalizeAdmin2faCode,
  runAdmin2faEnrollmentStart,
  runAdmin2faVerification,
} from "../src/lib/admin-2fa-gate.mjs";

const KEY = "cle";
const NOW = 1_798_000_000_000;

function makeDeps(overrides = {}) {
  const calls = { failures: 0, resets: 0, confirm: [], record: [], verify: [] };
  const deps = {
    checkRateLimit: async () => ({ allowed: true }),
    recordFailure: async () => { calls.failures += 1; },
    resetAttempts: async () => { calls.resets += 1; },
    readKey: () => KEY,
    getLoginState: async () => ({ ok: true, status: "enabled", secretEncrypted: "v1:abc", lastUsedStep: 41 }),
    decrypt: (value, key) => (value === "v1:abc" && key === KEY ? "SECRET" : null),
    verifyCode: (input) => {
      calls.verify.push(input);
      return input.code === "123456" ? { ok: true, step: 42 } : { ok: false };
    },
    confirmEnrollment: async (input) => { calls.confirm.push(input); return { ok: true }; },
    recordLogin: async (input) => { calls.record.push(input); return { ok: true }; },
    ...overrides,
  };
  return { deps, calls };
}

test("2FA connexion : code valide d'une 2FA active, pas enregistré, essais remis à zéro", async () => {
  const { deps, calls } = makeDeps();
  assert.deepEqual(await runAdmin2faVerification({ userId: "u1", code: " 123 456 ", nowMs: NOW, deps }), { ok: true });
  assert.deepEqual(calls.verify, [{ secret: "SECRET", code: "123456", nowMs: NOW, lastUsedStep: 41 }]);
  assert.deepEqual(calls.record, [{ userId: "u1", secretEncrypted: "v1:abc", step: 42 }]);
  assert.equal(calls.confirm.length, 0);
  assert.equal(calls.resets, 1);
  assert.equal(calls.failures, 0);
});

test("2FA connexion : premier code d'une activation en attente, sans anti-rejeu préalable", async () => {
  const { deps, calls } = makeDeps({
    getLoginState: async () => ({ ok: true, status: "pending", secretEncrypted: "v1:abc" }),
  });
  assert.deepEqual(await runAdmin2faVerification({ userId: "u1", code: "123456", nowMs: NOW, deps }), { ok: true });
  assert.equal(calls.verify[0].lastUsedStep, null);
  assert.deepEqual(calls.confirm, [{ userId: "u1", secretEncrypted: "v1:abc", step: 42 }]);
  assert.equal(calls.record.length, 0);
});

test("2FA connexion : étape expirée ou format invalide, sans compter d'essai", async () => {
  for (const userId of [null, ""]) {
    const { deps, calls } = makeDeps();
    assert.deepEqual(await runAdmin2faVerification({ userId, code: "123456", nowMs: NOW, deps }), { ok: false, reason: "expired" });
    assert.equal(calls.verify.length, 0);
  }
  for (const code of ["12345", "1234567", "abcdef", null, 123456]) {
    const { deps, calls } = makeDeps();
    assert.deepEqual(await runAdmin2faVerification({ userId: "u1", code, nowMs: NOW, deps }), { ok: false, reason: "invalid_format" });
    assert.equal(calls.failures, 0);
  }
});

test("2FA connexion : limite d'essais atteinte, aucun code vérifié", async () => {
  const { deps, calls } = makeDeps({ checkRateLimit: async () => ({ allowed: false }) });
  assert.deepEqual(await runAdmin2faVerification({ userId: "u1", code: "123456", nowMs: NOW, deps }), { ok: false, reason: "rate_limited" });
  assert.equal(calls.verify.length, 0);
});

test("2FA connexion : clé absente, compte refusé, aucune 2FA ou secret illisible", async () => {
  const cases = [
    [{ readKey: () => null }, "misconfigured"],
    [{ getLoginState: async () => ({ ok: false, reason: "not_authorized" }) }, "not_authorized"],
    [{ getLoginState: async () => ({ ok: true, status: "none" }) }, "not_enrolled"],
    [{ decrypt: () => null }, "unreadable"],
  ];
  for (const [overrides, reason] of cases) {
    const { deps, calls } = makeDeps(overrides);
    assert.deepEqual(await runAdmin2faVerification({ userId: "u1", code: "123456", nowMs: NOW, deps }), { ok: false, reason });
    assert.equal(calls.verify.length, 0);
    assert.equal(calls.resets, 0);
  }
});

test("2FA connexion : code faux compté comme échec, rien n'est enregistré", async () => {
  const { deps, calls } = makeDeps();
  assert.deepEqual(await runAdmin2faVerification({ userId: "u1", code: "000000", nowMs: NOW, deps }), { ok: false, reason: "invalid_code" });
  assert.equal(calls.failures, 1);
  assert.equal(calls.record.length, 0);
  assert.equal(calls.resets, 0);
});

test("2FA connexion : code rejoué refusé par la base et compté comme échec", async () => {
  const { deps, calls } = makeDeps({ recordLogin: async () => ({ ok: false, reason: "replayed" }) });
  assert.deepEqual(await runAdmin2faVerification({ userId: "u1", code: "123456", nowMs: NOW, deps }), { ok: false, reason: "replayed" });
  assert.equal(calls.failures, 1);
  assert.equal(calls.resets, 0);
});

test("2FA connexion : refus de la base à l'activation ou à la connexion", async () => {
  const pending = async () => ({ ok: true, status: "pending", secretEncrypted: "v1:abc" });
  const cases = [
    [{ getLoginState: pending, confirmEnrollment: async () => ({ ok: false, reason: "not_pending" }) }, "not_enrolled"],
    [{ getLoginState: pending, confirmEnrollment: async () => ({ ok: false, reason: "not_authorized" }) }, "not_authorized"],
    [{ recordLogin: async () => ({ ok: false, reason: "not_authorized" }) }, "not_authorized"],
  ];
  for (const [overrides, reason] of cases) {
    const { deps, calls } = makeDeps(overrides);
    assert.deepEqual(await runAdmin2faVerification({ userId: "u1", code: "123456", nowMs: NOW, deps }), { ok: false, reason });
    assert.equal(calls.resets, 0);
  }
});

test("2FA activation avant session : secret chiffré enregistré", async () => {
  const started = [];
  const deps = {
    readKey: () => KEY,
    generateSecret: () => "SECRET",
    encrypt: (secret, key) => `enc(${secret},${key})`,
    startEnrollment: async (input) => { started.push(input); return { ok: true }; },
  };
  assert.deepEqual(await runAdmin2faEnrollmentStart({ userId: "u1", deps }), { ok: true });
  assert.deepEqual(started, [{ userId: "u1", secretEncrypted: "enc(SECRET,cle)" }]);
});

test("2FA activation avant session : étape expirée, clé absente, déjà active ou refus", async () => {
  const base = {
    readKey: () => KEY,
    generateSecret: () => "SECRET",
    encrypt: () => "enc",
    startEnrollment: async () => ({ ok: true }),
  };
  assert.deepEqual(await runAdmin2faEnrollmentStart({ userId: null, deps: base }), { ok: false, reason: "expired" });
  assert.deepEqual(await runAdmin2faEnrollmentStart({ userId: "u1", deps: { ...base, readKey: () => null } }), { ok: false, reason: "misconfigured" });
  assert.deepEqual(
    await runAdmin2faEnrollmentStart({ userId: "u1", deps: { ...base, startEnrollment: async () => ({ ok: false, reason: "already_enabled" }) } }),
    { ok: false, reason: "already_enabled" },
  );
  assert.deepEqual(
    await runAdmin2faEnrollmentStart({ userId: "u1", deps: { ...base, startEnrollment: async () => ({ ok: false, reason: "not_authorized" }) } }),
    { ok: false, reason: "not_authorized" },
  );
});

test("2FA : code normalisé et messages en français", () => {
  assert.equal(normalizeAdmin2faCode("12 34 56"), "123456");
  assert.equal(normalizeAdmin2faCode("12a456"), null);
  assert.equal(getAdmin2faMessage("invalid_code"), "Code incorrect. Vérifiez l’heure du téléphone et réessayez.");
  assert.equal(getAdmin2faMessage("inconnu"), "Accès refusé.");
});
