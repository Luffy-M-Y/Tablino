import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTotpUri,
  computeHotpCode,
  decodeBase32,
  decryptTotpSecret,
  encodeBase32,
  encryptTotpSecret,
  generateRecoveryCodes,
  generateTotpSecret,
  getTotpStep,
  hashRecoveryCode,
  normalizeRecoveryCode,
  readTotpEncryptionKey,
  verifyTotpCode,
} from "../src/totp";

// Secret des vecteurs RFC 6238 (SHA-1) : "12345678901234567890" en ASCII.
const RFC_SECRET = encodeBase32(Buffer.from("12345678901234567890"));
const KEY = Buffer.alloc(32, 7);

test("base32 : vecteurs RFC 4648 et aller-retour", () => {
  assert.equal(encodeBase32(Buffer.from("foobar")), "MZXW6YTBOI");
  assert.equal(encodeBase32(Buffer.from("f")), "MY");
  assert.equal(decodeBase32("MZXW6YTBOI")?.toString(), "foobar");
  assert.equal(decodeBase32("mzxw 6ytb oi==")?.toString(), "foobar");
  assert.equal(RFC_SECRET, "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
  assert.equal(decodeBase32(""), null);
  assert.equal(decodeBase32("ABC1"), null);
  assert.equal(decodeBase32("AB8C"), null);
});

test("HOTP : vecteurs RFC 4226", () => {
  const secret = Buffer.from("12345678901234567890");
  const expected = ["755224", "287082", "359152", "969429", "338314", "254676", "287922", "162583", "399871", "520489"];
  expected.forEach((code, counter) => assert.equal(computeHotpCode(secret, counter), code));
});

test("TOTP : vecteurs RFC 6238 (6 derniers chiffres)", () => {
  const cases: Array<[number, string]> = [
    [59, "287082"],
    [1111111109, "081804"],
    [1111111111, "050471"],
    [1234567890, "005924"],
    [2000000000, "279037"],
    [20000000000, "353130"],
  ];
  for (const [seconds, code] of cases) {
    const result = verifyTotpCode({ secret: RFC_SECRET, code, nowMs: seconds * 1000, lastUsedStep: null });
    assert.deepEqual(result, { ok: true, step: Math.floor(seconds / 30) }, String(seconds));
  }
});

test("TOTP : un pas d'écart accepté, deux refusés", () => {
  const secret = Buffer.from("12345678901234567890");
  const nowMs = 1234567890 * 1000;
  const step = getTotpStep(nowMs);
  for (const [offset, ok] of [[-2, false], [-1, true], [0, true], [1, true], [2, false]] as const) {
    const code = computeHotpCode(secret, step + offset);
    const result = verifyTotpCode({ secret: RFC_SECRET, code, nowMs, lastUsedStep: null });
    assert.equal(result.ok, ok, String(offset));
    if (result.ok) assert.equal(result.step, step + offset);
  }
});

test("TOTP : anti-rejeu par lastUsedStep", () => {
  const nowMs = 59 * 1000;
  assert.deepEqual(verifyTotpCode({ secret: RFC_SECRET, code: "287082", nowMs, lastUsedStep: 0 }), { ok: true, step: 1 });
  assert.deepEqual(verifyTotpCode({ secret: RFC_SECRET, code: "287082", nowMs, lastUsedStep: 1 }), { ok: false });
  assert.deepEqual(verifyTotpCode({ secret: RFC_SECRET, code: "287082", nowMs, lastUsedStep: 5 }), { ok: false });
});

test("TOTP : formes de code et secrets invalides refusés", () => {
  const nowMs = 59 * 1000;
  for (const code of ["", "28708", "2870820", "28708a", "-28708", "287 08", "２８７０８２"]) {
    assert.deepEqual(verifyTotpCode({ secret: RFC_SECRET, code, nowMs, lastUsedStep: null }), { ok: false }, code);
  }
  assert.deepEqual(verifyTotpCode({ secret: RFC_SECRET, code: " 287 082 ", nowMs, lastUsedStep: null }), { ok: true, step: 1 });
  assert.deepEqual(verifyTotpCode({ secret: RFC_SECRET, code: "000000", nowMs, lastUsedStep: null }), { ok: false });
  assert.deepEqual(verifyTotpCode({ secret: "invalide!", code: "287082", nowMs, lastUsedStep: null }), { ok: false });
  assert.deepEqual(verifyTotpCode({ secret: "GEZDGNBV", code: "287082", nowMs, lastUsedStep: null }), { ok: false });
});

test("secret généré : 32 caractères base32, 20 octets, unique", () => {
  const a = generateTotpSecret();
  const b = generateTotpSecret();
  assert.match(a, /^[A-Z2-7]{32}$/);
  assert.equal(decodeBase32(a)?.length, 20);
  assert.notEqual(a, b);
});

test("adresse otpauth : émetteur, compte encodé, paramètres", () => {
  const uri = buildTotpUri({ secret: RFC_SECRET, accountName: "admin+test@exemple.bf" });
  assert.ok(uri.startsWith("otpauth://totp/Tablino:admin%2Btest%40exemple.bf?"));
  const params = new URL(uri).searchParams;
  assert.equal(params.get("secret"), RFC_SECRET);
  assert.equal(params.get("issuer"), "Tablino");
  assert.equal(params.get("algorithm"), "SHA1");
  assert.equal(params.get("digits"), "6");
  assert.equal(params.get("period"), "30");
});

test("clé TOTP_ENCRYPTION_KEY : 64 hexadécimaux seulement", () => {
  assert.equal(readTotpEncryptionKey({ TOTP_ENCRYPTION_KEY: "ab".repeat(32) })?.length, 32);
  for (const value of [undefined, "", "ab".repeat(31), "ab".repeat(33), "zz".repeat(32), ` ${"ab".repeat(32)}`]) {
    assert.equal(readTotpEncryptionKey({ TOTP_ENCRYPTION_KEY: value }), null, String(value));
  }
});

test("chiffrement du secret : aller-retour, IV aléatoire, format v1", () => {
  const a = encryptTotpSecret(RFC_SECRET, KEY);
  const b = encryptTotpSecret(RFC_SECRET, KEY);
  assert.match(a, /^v1:[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/);
  assert.notEqual(a, b);
  assert.ok(!a.includes(RFC_SECRET));
  assert.equal(decryptTotpSecret(a, KEY), RFC_SECRET);
  assert.throws(() => encryptTotpSecret(RFC_SECRET, Buffer.alloc(16)));
  assert.throws(() => encryptTotpSecret("", KEY));
});

test("déchiffrement refusé : mauvaise clé, données altérées, format inconnu", () => {
  const value = encryptTotpSecret(RFC_SECRET, KEY);
  const [version, iv, tag, data] = value.split(":");
  assert.equal(decryptTotpSecret(value, Buffer.alloc(32, 8)), null);
  assert.equal(decryptTotpSecret(value, Buffer.alloc(16)), null);
  const flipped = (data[0] === "0" ? "1" : "0") + data.slice(1);
  assert.equal(decryptTotpSecret([version, iv, tag, flipped].join(":"), KEY), null);
  const badTag = (tag[0] === "0" ? "1" : "0") + tag.slice(1);
  assert.equal(decryptTotpSecret([version, iv, badTag, data].join(":"), KEY), null);
  for (const bad of ["", "v2:" + value.slice(3), [version, iv, tag].join(":"), [version, iv.slice(2), tag, data].join(":"), [version, iv, tag, data + "0"].join(":")]) {
    assert.equal(decryptTotpSecret(bad, KEY), null, bad.slice(0, 20));
  }
});

test("codes de secours : 10 codes uniques, forme XXXX-XXXX-XXXX-XXXX", () => {
  const codes = generateRecoveryCodes();
  assert.equal(codes.length, 10);
  assert.equal(new Set(codes).size, 10);
  for (const code of codes) assert.match(code, /^[A-Z2-7]{4}(-[A-Z2-7]{4}){3}$/);
  assert.equal(generateRecoveryCodes(3).length, 3);
});

test("codes de secours : normalisation et empreinte SHA-256", () => {
  const code = "ABCD-EFGH-2345-67AB";
  assert.equal(normalizeRecoveryCode(code), "ABCDEFGH234567AB");
  assert.equal(normalizeRecoveryCode(" abcd efgh 2345 67ab "), "ABCDEFGH234567AB");
  const hash = hashRecoveryCode(code);
  assert.match(hash ?? "", /^[0-9a-f]{64}$/);
  assert.equal(hashRecoveryCode("abcdefgh234567ab"), hash);
  assert.notEqual(hashRecoveryCode("ABCD-EFGH-2345-67AC"), hash);
  for (const bad of ["", "ABCD-EFGH-2345-67A", "ABCD-EFGH-2345-67ABC", "ABCD-EFGH-2345-6701", "ABCD_EFGH_2345_67AB"]) {
    assert.equal(normalizeRecoveryCode(bad), null, bad);
    assert.equal(hashRecoveryCode(bad), null, bad);
  }
});
