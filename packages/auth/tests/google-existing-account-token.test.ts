import assert from "node:assert/strict";
import test from "node:test";
import {
  createGoogleExistingAccountToken,
  GOOGLE_EXISTING_ACCOUNT_TOKEN_TTL_MS,
  verifyGoogleExistingAccountToken,
} from "../src/google-existing-account-token";

const SECRET = "test-secret-long-enough-for-hkdf-32bytes";
const NOW = 1_800_000_000_000;
const EMAIL = "Student@Example.COM";
const UNIVERSITY_ID = "university-1";

test("aller-retour valide", () => {
  const token = createGoogleExistingAccountToken({ email: EMAIL, universityId: UNIVERSITY_ID, now: NOW, secret: SECRET });
  const result = verifyGoogleExistingAccountToken(token, { now: NOW, secret: SECRET });
  assert.deepEqual(result, { email: "student@example.com", universityId: UNIVERSITY_ID });
});

test("e-mail normalisé en minuscules et trimé", () => {
  const token = createGoogleExistingAccountToken({ email: "  Student@EXAMPLE.COM  ", universityId: UNIVERSITY_ID, now: NOW, secret: SECRET });
  const result = verifyGoogleExistingAccountToken(token, { now: NOW, secret: SECRET });
  assert.equal(result?.email, "student@example.com");
});

test("secret différent → null", () => {
  const token = createGoogleExistingAccountToken({ email: EMAIL, universityId: UNIVERSITY_ID, now: NOW, secret: SECRET });
  assert.equal(verifyGoogleExistingAccountToken(token, { now: NOW, secret: "autre-secret-long-enough-for-hkdf" }), null);
});

test("octet modifié → null (GCM tag)", () => {
  const token = createGoogleExistingAccountToken({ email: EMAIL, universityId: UNIVERSITY_ID, now: NOW, secret: SECRET });
  const bytes = Buffer.from(token, "base64url");
  bytes[bytes.length - 1] ^= 1;
  assert.equal(verifyGoogleExistingAccountToken(bytes.toString("base64url"), { now: NOW, secret: SECRET }), null);
});

test("expiré (now = x) → null", () => {
  const token = createGoogleExistingAccountToken({ email: EMAIL, universityId: UNIVERSITY_ID, now: NOW, secret: SECRET });
  assert.equal(
    verifyGoogleExistingAccountToken(token, { now: NOW + GOOGLE_EXISTING_ACCOUNT_TOKEN_TTL_MS, secret: SECRET }),
    null,
  );
});

test("juste avant expiration → valide", () => {
  const token = createGoogleExistingAccountToken({ email: EMAIL, universityId: UNIVERSITY_ID, now: NOW, secret: SECRET });
  const result = verifyGoogleExistingAccountToken(token, { now: NOW + GOOGLE_EXISTING_ACCOUNT_TOKEN_TTL_MS - 1, secret: SECRET });
  assert.ok(result !== null);
});

test("jeton vide → null", () => {
  assert.equal(verifyGoogleExistingAccountToken("", { now: NOW, secret: SECRET }), null);
});

test("garbage → null", () => {
  assert.equal(verifyGoogleExistingAccountToken("garbage!!notbase64url", { now: NOW, secret: SECRET }), null);
});

test("l'e-mail n'apparaît pas en clair dans le jeton", () => {
  const token = createGoogleExistingAccountToken({ email: EMAIL, universityId: UNIVERSITY_ID, now: NOW, secret: SECRET });
  assert.equal(token.includes("student@example.com"), false);
  assert.equal(token.includes("Student@Example.COM"), false);
  // Vérifie aussi le décodage base64 brut.
  const decoded = Buffer.from(token, "base64url").toString("binary");
  assert.equal(decoded.includes("student@example.com"), false);
});

test("secret vide à la création → erreur", () => {
  assert.throws(
    () => createGoogleExistingAccountToken({ email: EMAIL, universityId: UNIVERSITY_ID, now: NOW, secret: "" }),
    { message: "Secret de signature absent." },
  );
});

test("verify avec secret vide → null (pas d'exception)", () => {
  const token = createGoogleExistingAccountToken({ email: EMAIL, universityId: UNIVERSITY_ID, now: NOW, secret: SECRET });
  assert.equal(verifyGoogleExistingAccountToken(token, { now: NOW, secret: "" }), null);
});

test("verify avec secret undefined → null (pas d'exception)", () => {
  const token = createGoogleExistingAccountToken({ email: EMAIL, universityId: UNIVERSITY_ID, now: NOW, secret: SECRET });
  assert.equal(verifyGoogleExistingAccountToken(token, { now: NOW, secret: undefined }), null);
});
