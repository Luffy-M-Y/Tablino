import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

// TOTP RFC 6238 (HOTP RFC 4226) : SHA-1, 6 chiffres, pas de 30 s.
export const TOTP_PERIOD_SECONDS = 30;
export const TOTP_DIGITS = 6;
export const TOTP_WINDOW_STEPS = 1;
export const TOTP_SECRET_BYTES = 20;
export const TOTP_ISSUER = "Tablino";
export const TOTP_RECOVERY_CODE_COUNT = 10;

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const ENCRYPTION_IV_LENGTH = 12;
const ENCRYPTION_TAG_LENGTH = 16;
const RECOVERY_CODE_LENGTH = 16;

export function encodeBase32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

/** Décode du base32 RFC 4648 (sans remplissage). Renvoie null si invalide. */
export function decodeBase32(input: string): Buffer | null {
  const clean = input.replace(/[\s=]/g, "").toUpperCase();
  if (clean.length === 0 || !/^[A-Z2-7]+$/.test(clean)) return null;
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    value = (value << 5) | BASE32_ALPHABET.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** Nouveau secret TOTP : 20 octets aléatoires, en base32 (32 caractères). */
export function generateTotpSecret(): string {
  return encodeBase32(randomBytes(TOTP_SECRET_BYTES));
}

export function getTotpStep(nowMs: number): number {
  return Math.floor(nowMs / 1000 / TOTP_PERIOD_SECONDS);
}

/** Code HOTP (RFC 4226) pour un compteur donné. */
export function computeHotpCode(secret: Uint8Array, counter: number): string {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", secret).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24)
    | (digest[offset + 1] << 16)
    | (digest[offset + 2] << 8)
    | digest[offset + 3];
  return String(binary % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0");
}

export type TotpVerification = { ok: true; step: number } | { ok: false };

/**
 * Vérifie un code TOTP : 6 chiffres, pas courant plus ou moins 1.
 * Anti-rejeu : un pas inférieur ou égal à lastUsedStep est refusé.
 */
export function verifyTotpCode(input: {
  secret: string;
  code: string;
  nowMs: number;
  lastUsedStep: number | null;
}): TotpVerification {
  const code = input.code.replace(/\s/g, "");
  if (!/^[0-9]{6}$/.test(code)) return { ok: false };
  const secret = decodeBase32(input.secret);
  if (secret === null || secret.length < 10) return { ok: false };
  const current = getTotpStep(input.nowMs);
  const expected = Buffer.from(code);
  let matched: number | null = null;
  for (let step = current - TOTP_WINDOW_STEPS; step <= current + TOTP_WINDOW_STEPS; step += 1) {
    if (step < 0) continue;
    const candidate = Buffer.from(computeHotpCode(secret, step));
    if (timingSafeEqual(candidate, expected) && matched === null) matched = step;
  }
  if (matched === null) return { ok: false };
  if (input.lastUsedStep !== null && matched <= input.lastUsedStep) return { ok: false };
  return { ok: true, step: matched };
}

/** Adresse otpauth:// lue par les applications d'authentification (QR code). */
export function buildTotpUri(input: { secret: string; accountName: string }): string {
  const label = `${encodeURIComponent(TOTP_ISSUER)}:${encodeURIComponent(input.accountName)}`;
  const params = new URLSearchParams({
    secret: input.secret,
    issuer: TOTP_ISSUER,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/** Clé de chiffrement TOTP_ENCRYPTION_KEY : 64 caractères hexadécimaux, sinon null. */
export function readTotpEncryptionKey(env: Record<string, string | undefined> = process.env): Buffer | null {
  const value = env.TOTP_ENCRYPTION_KEY;
  if (typeof value !== "string" || !/^[0-9a-fA-F]{64}$/.test(value)) return null;
  return Buffer.from(value, "hex");
}

/** Chiffre le secret TOTP (AES-256-GCM) : v1:iv:balise:données, en hexadécimal. */
export function encryptTotpSecret(secret: string, key: Buffer): string {
  if (key.length !== 32 || secret.length === 0) {
    throw new Error("Chiffrement du secret TOTP impossible.");
  }
  const iv = randomBytes(ENCRYPTION_IV_LENGTH);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv, { authTagLength: ENCRYPTION_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return `v1:${iv.toString("hex")}:${cipher.getAuthTag().toString("hex")}:${encrypted.toString("hex")}`;
}

/** Déchiffre le secret TOTP. Renvoie null si le format, la clé ou la balise est invalide. */
export function decryptTotpSecret(value: string, key: Buffer): string | null {
  if (key.length !== 32) return null;
  const parts = value.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") return null;
  const [, ivHex, tagHex, dataHex] = parts;
  if (!/^[0-9a-f]{24}$/.test(ivHex) || !/^[0-9a-f]{32}$/.test(tagHex) || !/^(?:[0-9a-f]{2})+$/.test(dataHex)) {
    return null;
  }
  try {
    const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, Buffer.from(ivHex, "hex"), {
      authTagLength: ENCRYPTION_TAG_LENGTH,
    });
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    return Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** Codes de secours : 16 caractères base32 (80 bits), affichés XXXX-XXXX-XXXX-XXXX. */
export function generateRecoveryCodes(count: number = TOTP_RECOVERY_CODE_COUNT): string[] {
  const codes: string[] = [];
  while (codes.length < count) {
    const raw = encodeBase32(randomBytes(10)).slice(0, RECOVERY_CODE_LENGTH);
    const formatted = raw.match(/.{4}/g)!.join("-");
    if (!codes.includes(formatted)) codes.push(formatted);
  }
  return codes;
}

/** Normalise un code de secours saisi. Renvoie null si la forme est invalide. */
export function normalizeRecoveryCode(input: string): string | null {
  const clean = input.replace(/[\s-]/g, "").toUpperCase();
  return new RegExp(`^[A-Z2-7]{${RECOVERY_CODE_LENGTH}}$`).test(clean) ? clean : null;
}

/** Empreinte SHA-256 (64 caractères hexadécimaux) d'un code de secours normalisé. */
export function hashRecoveryCode(input: string): string | null {
  const normalized = normalizeRecoveryCode(input);
  if (normalized === null) return null;
  return createHash("sha256").update(normalized).digest("hex");
}
