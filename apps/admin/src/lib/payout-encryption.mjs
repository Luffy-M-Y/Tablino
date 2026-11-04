import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

export function isValidEncryptionKey(keyHex) {
  return typeof keyHex === "string" && /^[0-9a-fA-F]{64}$/.test(keyHex);
}

export function encryptPayoutNumber(plainText, keyHex) {
  if (!isValidEncryptionKey(keyHex) || typeof plainText !== "string" || plainText.length === 0) {
    throw new Error("Opération de chiffrement impossible : paramètres invalides.");
  }

  const keyBuffer = Buffer.from(keyHex, "hex");
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);

  let encrypted = cipher.update(plainText, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();

  return `v1:${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

export function decryptPayoutNumber(encryptedString, keyHex) {
  if (!isValidEncryptionKey(keyHex) || typeof encryptedString !== "string") {
    throw new Error("Opération de déchiffrement impossible : paramètres invalides.");
  }

  const parts = encryptedString.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new Error("Format de données chiffrées non reconnu.");
  }

  const [, ivHex, tagHex, cipherHex] = parts;
  const authTag = Buffer.from(tagHex, "hex");
  if (authTag.length !== 16) {
    throw new Error("Longueur de balise d'authentification invalide.");
  }

  try {
    const keyBuffer = Buffer.from(keyHex, "hex");
    const iv = Buffer.from(ivHex, "hex");

    const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, iv, { authTagLength: 16 });
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(cipherHex, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch {
    throw new Error("Échec du déchiffrement des données.");
  }
}

export function encryptPayoutNumberWithEnv(plainText) {
  const keyHex = process.env.PAYOUT_ENCRYPTION_KEY;
  return encryptPayoutNumber(plainText, keyHex);
}

export function decryptPayoutNumberWithEnv(encryptedString) {
  const keyHex = process.env.PAYOUT_ENCRYPTION_KEY;
  return decryptPayoutNumber(encryptedString, keyHex);
}

