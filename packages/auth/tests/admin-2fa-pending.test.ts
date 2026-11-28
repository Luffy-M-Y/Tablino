import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import {
  ADMIN_2FA_PENDING_TTL_MS,
  createAdmin2faPendingToken,
  getAdmin2faPendingCookieConfig,
  verifyAdmin2faPendingToken,
} from "../src/admin-2fa-pending";
import { createEmailVerificationToken } from "../src/email-verification-token";

const secret = "test-signing-secret-with-enough-length";
const now = 1_798_000_000_000;
const userId = "admin-id";
const host = "iscom-admin.localhost:3001";

function sign(payload: unknown): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return encoded + "." + createHmac("sha256", secret).update(encoded).digest("base64url");
}

test("Le jeton 2FA renvoie l'utilisateur sur le même hôte, casse et espaces ignorés", () => {
  const token = createAdmin2faPendingToken(userId, " ISCOM-admin.localhost:3001 ", now, secret);
  assert.equal(verifyAdmin2faPendingToken(token, host, now, secret), userId);
  assert.equal(verifyAdmin2faPendingToken(token, host, now + ADMIN_2FA_PENDING_TTL_MS, secret), userId);
});

test("Le jeton 2FA est refusé sur un autre hôte", () => {
  const token = createAdmin2faPendingToken(userId, host, now, secret);
  assert.equal(verifyAdmin2faPendingToken(token, "sup-admin.localhost:3001", now, secret), null);
  assert.equal(verifyAdmin2faPendingToken(token, "", now, secret), null);
  assert.equal(verifyAdmin2faPendingToken(token, null, now, secret), null);
});

test("Le jeton 2FA expire après 5 minutes", () => {
  assert.equal(ADMIN_2FA_PENDING_TTL_MS, 300000);
  const token = createAdmin2faPendingToken(userId, host, now, secret);
  assert.equal(verifyAdmin2faPendingToken(token, host, now + ADMIN_2FA_PENDING_TTL_MS + 1, secret), null);
});

test("Le jeton 2FA refuse une signature modifiée, un autre secret ou une forme invalide", () => {
  const token = createAdmin2faPendingToken(userId, host, now, secret);
  const [encoded, signature] = token.split(".");
  const changed = (signature[0] === "A" ? "B" : "A") + signature.slice(1);
  assert.equal(verifyAdmin2faPendingToken(encoded + "." + changed, host, now, secret), null);
  assert.equal(verifyAdmin2faPendingToken(token, host, now, "another-signing-secret-long-enough"), null);
  for (const bad of ["", "abc", "a.b.c", `.${signature}`, `${encoded}.`, 42, undefined]) {
    assert.equal(verifyAdmin2faPendingToken(bad, host, now, secret), null);
  }
});

test("Le jeton 2FA refuse un autre but, un utilisateur vide ou un délai non numérique", () => {
  const emailToken = createEmailVerificationToken(userId, now, secret);
  assert.equal(verifyAdmin2faPendingToken(emailToken, host, now, secret), null);
  const base = { p: "admin-2fa-pending", u: userId, h: host, x: now + 1000 };
  assert.equal(verifyAdmin2faPendingToken(sign(base), host, now, secret), userId);
  assert.equal(verifyAdmin2faPendingToken(sign({ ...base, u: "" }), host, now, secret), null);
  assert.equal(verifyAdmin2faPendingToken(sign({ ...base, x: "9999999999999" }), host, now, secret), null);
  assert.equal(verifyAdmin2faPendingToken(sign([base]), host, now, secret), null);
});

test("La création du jeton 2FA refuse un utilisateur ou un hôte vide", () => {
  assert.throws(() => createAdmin2faPendingToken("", host, now, secret));
  assert.throws(() => createAdmin2faPendingToken(userId, "  ", now, secret));
  assert.throws(() => createAdmin2faPendingToken(userId, host, now, "court"));
});

test("Le cookie 2FA est httpOnly, lax, 5 minutes", () => {
  const config = getAdmin2faPendingCookieConfig();
  assert.match(config.name, /^(__Secure-)?tablino-admin\.2fa-pending$/);
  assert.equal(config.options.httpOnly, true);
  assert.equal(config.options.sameSite, "lax");
  assert.equal(config.options.path, "/");
  assert.equal(config.options.maxAge, 300);
});
