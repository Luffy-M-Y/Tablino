import assert from "node:assert/strict";
import test from "node:test";
import {
  decryptPayoutNumber,
  decryptPayoutNumberWithEnv,
  encryptPayoutNumber,
  encryptPayoutNumberWithEnv,
  isValidEncryptionKey,
} from "../src/lib/payout-encryption.mjs";

const VALID_KEY_1 = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const VALID_KEY_2 = "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210";

test("isValidEncryptionKey validates 64-char hex keys", () => {
  assert.equal(isValidEncryptionKey(VALID_KEY_1), true);
  assert.equal(isValidEncryptionKey(VALID_KEY_2), true);
  assert.equal(isValidEncryptionKey("short"), false);
  assert.equal(isValidEncryptionKey(VALID_KEY_1.slice(0, 63)), false);
  assert.equal(isValidEncryptionKey(`${VALID_KEY_1}00`), false);
  assert.equal(isValidEncryptionKey("zz".repeat(32)), false);
  assert.equal(isValidEncryptionKey(null), false);
  assert.equal(isValidEncryptionKey(undefined), false);
});

test("encryption and decryption round-trip (aller-retour) restores plaintext", () => {
  const plainText = "+22670123456";
  const encrypted = encryptPayoutNumber(plainText, VALID_KEY_1);

  assert.ok(encrypted.startsWith("v1:"));
  const decrypted = decryptPayoutNumber(encrypted, VALID_KEY_1);
  assert.equal(decrypted, plainText);
});

test("decryption with wrong key (mauvaise clé) throws error", () => {
  const plainText = "+22676543210";
  const encrypted = encryptPayoutNumber(plainText, VALID_KEY_1);

  assert.throws(
    () => decryptPayoutNumber(encrypted, VALID_KEY_2),
    /déchiffrement/i,
  );
});

test("tampered ciphertext or tag (donnée altérée) throws error", () => {
  const plainText = "+22670998877";
  const encrypted = encryptPayoutNumber(plainText, VALID_KEY_1);
  const parts = encrypted.split(":");
  assert.equal(parts.length, 4);

  // Alter cipher part (guaranteed to differ)
  const originalCipher = parts[3];
  const alteredCipherChar = originalCipher[0] === "a" ? "b" : "a";
  const tamperedCipher = `${parts[0]}:${parts[1]}:${parts[2]}:${alteredCipherChar}${originalCipher.slice(1)}`;
  assert.throws(
    () => decryptPayoutNumber(tamperedCipher, VALID_KEY_1),
    /déchiffrement/i,
  );

  // Alter auth tag (guaranteed to differ)
  const originalTag = parts[2];
  const alteredTagChar = originalTag[0] === "a" ? "b" : "a";
  const tamperedTag = `${parts[0]}:${parts[1]}:${alteredTagChar}${originalTag.slice(1)}:${parts[3]}`;
  assert.throws(
    () => decryptPayoutNumber(tamperedTag, VALID_KEY_1),
    /déchiffrement/i,
  );

  // Alter version or format
  assert.throws(
    () => decryptPayoutNumber("v2:iv:tag:cipher", VALID_KEY_1),
    /format/i,
  );
  assert.throws(
    () => decryptPayoutNumber("invalid-format", VALID_KEY_1),
    /format/i,
  );
});

test("encrypted output never contains plaintext (aucun clair dans la sortie)", () => {
  const plainText = "+22678901234";
  const encrypted = encryptPayoutNumber(plainText, VALID_KEY_1);

  assert.equal(encrypted.includes(plainText), false);
  assert.equal(encrypted.includes("78901234"), false);
  assert.equal(encrypted.includes("+226"), false);
});

test("missing or empty key (clé absente) throws generic error", () => {
  const plainText = "+22670112233";

  assert.throws(
    () => encryptPayoutNumber(plainText, undefined),
    /chiffrement impossible/i,
  );
  assert.throws(
    () => encryptPayoutNumber(plainText, ""),
    /chiffrement impossible/i,
  );
  assert.throws(
    () => encryptPayoutNumber(plainText, null),
    /chiffrement impossible/i,
  );

  // Env wrapper without PAYOUT_ENCRYPTION_KEY set
  const savedKey = process.env.PAYOUT_ENCRYPTION_KEY;
  delete process.env.PAYOUT_ENCRYPTION_KEY;

  try {
    assert.throws(
      () => encryptPayoutNumberWithEnv(plainText),
      /chiffrement impossible/i,
    );
    assert.throws(
      () => decryptPayoutNumberWithEnv("v1:iv:tag:cipher"),
      /déchiffrement impossible/i,
    );
  } finally {
    if (savedKey !== undefined) {
      process.env.PAYOUT_ENCRYPTION_KEY = savedKey;
    }
  }
});

test("env wrapper works correctly when PAYOUT_ENCRYPTION_KEY is configured", () => {
  const savedKey = process.env.PAYOUT_ENCRYPTION_KEY;
  process.env.PAYOUT_ENCRYPTION_KEY = VALID_KEY_1;

  try {
    const plainText = "+22670001122";
    const encrypted = encryptPayoutNumberWithEnv(plainText);
    const decrypted = decryptPayoutNumberWithEnv(encrypted);
    assert.equal(decrypted, plainText);
  } finally {
    if (savedKey !== undefined) {
      process.env.PAYOUT_ENCRYPTION_KEY = savedKey;
    } else {
      delete process.env.PAYOUT_ENCRYPTION_KEY;
    }
  }
});

