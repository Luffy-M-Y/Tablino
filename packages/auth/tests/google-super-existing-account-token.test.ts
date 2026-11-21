import assert from "node:assert/strict";
import test from "node:test";
import {
  createSuperGoogleExistingAccountToken,
  SUPER_GOOGLE_EXISTING_ACCOUNT_TOKEN_TTL_MS,
  verifySuperGoogleExistingAccountToken,
} from "../src/google-super-existing-account-token";
import {
  createGoogleExistingAccountToken,
  verifyGoogleExistingAccountToken,
} from "../src/google-existing-account-token";

const SECRET = "test-secret-long-enough-for-hkdf-32bytes";
const NOW = 1_800_000_000_000;
const EMAIL = "Admin@Example.COM";

test("aller-retour valide", () => {
  const token = createSuperGoogleExistingAccountToken({ email: EMAIL, now: NOW, secret: SECRET });
  const result = verifySuperGoogleExistingAccountToken(token, { now: NOW, secret: SECRET });
  assert.deepEqual(result, { email: "admin@example.com" });
});

test("pas de champ universityId dans le résultat", () => {
  const token = createSuperGoogleExistingAccountToken({ email: EMAIL, now: NOW, secret: SECRET });
  const result = verifySuperGoogleExistingAccountToken(token, { now: NOW, secret: SECRET });
  assert.equal("universityId" in (result as object), false);
});

test("expiré (now = x) → null", () => {
  const token = createSuperGoogleExistingAccountToken({ email: EMAIL, now: NOW, secret: SECRET });
  assert.equal(
    verifySuperGoogleExistingAccountToken(token, { now: NOW + SUPER_GOOGLE_EXISTING_ACCOUNT_TOKEN_TTL_MS, secret: SECRET }),
    null,
  );
});

test("octet modifié → null (GCM tag)", () => {
  const token = createSuperGoogleExistingAccountToken({ email: EMAIL, now: NOW, secret: SECRET });
  const bytes = Buffer.from(token, "base64url");
  bytes[bytes.length - 1] ^= 1;
  assert.equal(verifySuperGoogleExistingAccountToken(bytes.toString("base64url"), { now: NOW, secret: SECRET }), null);
});

test("secret différent → null", () => {
  const token = createSuperGoogleExistingAccountToken({ email: EMAIL, now: NOW, secret: SECRET });
  assert.equal(verifySuperGoogleExistingAccountToken(token, { now: NOW, secret: "autre-secret-long-enough-for-hkdf" }), null);
});

test("jeton université refusé par verify super (isolation inter-modules)", () => {
  const uniToken = createGoogleExistingAccountToken({
    email: EMAIL,
    universityId: "univ-1",
    now: NOW,
    secret: SECRET,
  });
  assert.equal(verifySuperGoogleExistingAccountToken(uniToken, { now: NOW, secret: SECRET }), null);
});

test("jeton super refusé par verify université (isolation inter-modules)", () => {
  const superToken = createSuperGoogleExistingAccountToken({ email: EMAIL, now: NOW, secret: SECRET });
  assert.equal(verifyGoogleExistingAccountToken(superToken, { now: NOW, secret: SECRET }), null);
});

test("secret vide à la création → erreur", () => {
  assert.throws(
    () => createSuperGoogleExistingAccountToken({ email: EMAIL, now: NOW, secret: "" }),
    { message: "Secret de signature absent." },
  );
});

test("verify avec secret vide → null (pas d'exception)", () => {
  const token = createSuperGoogleExistingAccountToken({ email: EMAIL, now: NOW, secret: SECRET });
  assert.equal(verifySuperGoogleExistingAccountToken(token, { now: NOW, secret: "" }), null);
});

test("verify avec secret undefined → null (pas d'exception)", () => {
  const token = createSuperGoogleExistingAccountToken({ email: EMAIL, now: NOW, secret: SECRET });
  assert.equal(verifySuperGoogleExistingAccountToken(token, { now: NOW, secret: undefined }), null);
});

test("l'e-mail n'apparaît pas en clair dans le jeton", () => {
  const token = createSuperGoogleExistingAccountToken({ email: EMAIL, now: NOW, secret: SECRET });
  assert.equal(token.includes("admin@example.com"), false);
  assert.equal(token.includes("Admin@Example.COM"), false);
  const decoded = Buffer.from(token, "base64url").toString("binary");
  assert.equal(decoded.includes("admin@example.com"), false);
});
