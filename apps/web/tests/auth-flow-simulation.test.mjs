import assert from "node:assert/strict";
import test from "node:test";
import {
  createAuthTransaction,
  verifyAuthTransaction,
  AUTH_TRANSACTION_TTL_MS,
} from "../src/lib/auth-transaction.mjs";
import { buildTenantUrl, getTenantReturnUrl } from "../src/lib/tenant-return-url.mjs";
import { buildTransferRedirectUrl } from "../src/lib/auth-central-transfer.mjs";
import { getReturnCode, resolveReturnDecision, resolveSessionAllowed } from "../src/lib/auth-central-return.mjs";
import { resolveErrorRedirect } from "../src/lib/auth-central-error-decision.mjs";

// SIMULATION — pas de Google réel, pas de cookies navigateur, pas de base réelle.
// Seules les fonctions pures sont testées. Le flux réel (OAuth, DB, cookies,
// redirections) n'est pas testé ici. Le callback signIn (packages/auth) n'est
// pas testable sans mocking de db (getUserByAccount, getUserByEmail).

const SECRET = "test-secret-with-enough-length";
const UNIVERSITY_ID = "university-1";
const OTHER_UNIVERSITY_ID = "university-2";
const SLUG = "iscom";
const ROOT_DOMAIN = "tablino.com";
const USER_ID = "user-1";
const NOW = new Date("2026-11-10T10:00:00.000Z");

// ─── 1. Départ : transaction créée et vérifiée ──────────────────────────────────

test("simulation: départ crée une transaction valide", () => {
  const tx = createAuthTransaction({ universityId: UNIVERSITY_ID, now: NOW, secret: SECRET });
  assert.equal(verifyAuthTransaction(tx, { now: NOW, secret: SECRET }), UNIVERSITY_ID);
});

// ─── 2. Transaction : URL de retour vers le sous-domaine ────────────────────────

test("simulation: getTenantReturnUrl construit l'URL de retour vers le sous-domaine", () => {
  const url = getTenantReturnUrl({ slug: SLUG, rootDomain: ROOT_DOMAIN, secure: true });
  assert.equal(url, "https://iscom.tablino.com/auth-central/return");
});

// ─── 3. Code : URL de transfert avec le code ─────────────────────────────────────

test("simulation: buildTransferRedirectUrl construit l'URL de transfert avec le code", () => {
  const url = buildTransferRedirectUrl({ slug: SLUG, rootDomain: ROOT_DOMAIN, secure: true, code: "abc123" });
  assert.equal(url, "https://iscom.tablino.com/auth-central/return?code=abc123");
});

// ─── 4. Retour : code extrait et décision de session ─────────────────────────────

test("simulation: getReturnCode extrait le code et resolveReturnDecision crée une session", () => {
  const params = new URLSearchParams();
  params.set("code", "abc123");
  const code = getReturnCode(params);
  const decision = resolveReturnDecision({ code, universityId: UNIVERSITY_ID, consumeResult: { userId: USER_ID } });
  assert.deepEqual(decision, { action: "session", userId: USER_ID });
});

// ─── 5. Erreur : décision de redirection depuis la transaction ─────────────────────

test("simulation: resolveErrorRedirect redirige vers /connexion?authError=1 pour une transaction valide", () => {
  const decision = resolveErrorRedirect({ universityId: UNIVERSITY_ID, slug: SLUG, rootDomain: ROOT_DOMAIN, secure: true });
  assert.deepEqual(decision, { action: "redirect", url: "https://iscom.tablino.com/connexion?authError=1" });
});

test("simulation: resolveErrorRedirect affiche un message générique sans transaction", () => {
  assert.deepEqual(
    resolveErrorRedirect({ universityId: null, slug: SLUG, rootDomain: ROOT_DOMAIN, secure: true }),
    { action: "render" },
  );
});

test("simulation: resolveErrorRedirect affiche un message générique avec transaction expirée", () => {
  const tx = createAuthTransaction({ universityId: UNIVERSITY_ID, now: NOW, secret: SECRET });
  const expired = new Date(NOW.getTime() + AUTH_TRANSACTION_TTL_MS + 1);
  const universityId = verifyAuthTransaction(tx, { now: expired, secret: SECRET });
  assert.equal(universityId, null);
  const decision = resolveErrorRedirect({ universityId, slug: SLUG, rootDomain: ROOT_DOMAIN, secure: true });
  assert.deepEqual(decision, { action: "render" });
});

test("simulation: resolveErrorRedirect affiche un message générique quand le slug est introuvable", () => {
  assert.deepEqual(
    resolveErrorRedirect({ universityId: UNIVERSITY_ID, slug: null, rootDomain: ROOT_DOMAIN, secure: true }),
    { action: "render" },
  );
});

test("simulation: resolveErrorRedirect affiche un message générique quand rootDomain est absent", () => {
  assert.deepEqual(
    resolveErrorRedirect({ universityId: UNIVERSITY_ID, slug: SLUG, rootDomain: undefined, secure: true }),
    { action: "render" },
  );
});

// ─── 6. resolveReturnDecision : consumeResult null → redirect ───────────────────

test("simulation: resolveReturnDecision retourne redirect quand consumeResult est null", () => {
  const decision = resolveReturnDecision({ code: "abc", universityId: UNIVERSITY_ID, consumeResult: null });
  assert.deepEqual(decision, { action: "redirect", path: "/connexion" });
});

// ─── 7. resolveReturnDecision : autre universityId, consumeResult null → redirect ─

test("simulation: resolveReturnDecision retourne redirect avec un universityId différent et consumeResult null", () => {
  const decision = resolveReturnDecision({ code: "abc", universityId: OTHER_UNIVERSITY_ID, consumeResult: null });
  assert.deepEqual(decision, { action: "redirect", path: "/connexion" });
});

// ─── 8. resolveSessionAllowed : utilisateur autorisé, révoqué, absent ─────────────

test("simulation: resolveSessionAllowed autorise un utilisateur non révoqué", () => {
  assert.deepEqual(resolveSessionAllowed({ userFound: true, revokedAt: null }), { allowed: true });
});

test("simulation: resolveSessionAllowed refuse un utilisateur révoqué", () => {
  assert.deepEqual(resolveSessionAllowed({ userFound: true, revokedAt: new Date() }), { allowed: false });
});

test("simulation: resolveSessionAllowed refuse un utilisateur absent", () => {
  assert.deepEqual(resolveSessionAllowed({ userFound: false, revokedAt: null }), { allowed: false });
});

// ─── 9. Transaction expirée : vérification échoue ───────────────────────────────

test("simulation: verifyAuthTransaction rejette une transaction expirée", () => {
  const tx = createAuthTransaction({ universityId: UNIVERSITY_ID, now: NOW, secret: SECRET });
  const expired = new Date(NOW.getTime() + AUTH_TRANSACTION_TTL_MS + 1);
  assert.equal(verifyAuthTransaction(tx, { now: expired, secret: SECRET }), null);
});

// ─── 10. buildTenantUrl : URL d'inscription vers le sous-domaine ─────────────────

test("simulation: buildTenantUrl construit l'URL d'inscription vers le sous-domaine", () => {
  const token = "google-signup-token";
  const url = buildTenantUrl({ slug: SLUG, rootDomain: ROOT_DOMAIN, secure: true, path: `inscription/google?token=${encodeURIComponent(token)}` });
  assert.equal(url, "https://iscom.tablino.com/inscription/google?token=google-signup-token");
});

// ─── 11. buildTenantUrl : slug invalide ──────────────────────────────────────────

test("simulation: buildTenantUrl retourne null pour un slug invalide", () => {
  assert.equal(
    buildTenantUrl({ slug: "admin", rootDomain: ROOT_DOMAIN, secure: true, path: "inscription/google?token=abc" }),
    null,
  );
});

// ─── 12. buildTenantUrl : rootDomain absent ─────────────────────────────────────

test("simulation: buildTenantUrl retourne null pour un rootDomain absent", () => {
  assert.equal(
    buildTenantUrl({ slug: SLUG, rootDomain: "", secure: false, path: "inscription/google?token=abc" }),
    null,
  );
});
