import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export function isPasswordValid(value: unknown): value is string {
  return typeof value === "string"
    && value.length >= PASSWORD_MIN_LENGTH
    && value.length <= PASSWORD_MAX_LENGTH;
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return "scrypt$" + salt.toString("hex") + "$" + hash.toString("hex");
}

export function verifyPassword(password: string, stored: string): boolean {
  if (typeof password !== "string" || typeof stored !== "string") return false;

  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;

  try {
    const salt = Buffer.from(parts[1], "hex");
    const expectedHash = Buffer.from(parts[2], "hex");
    if (
      salt.length !== 16
      || salt.toString("hex") !== parts[1]
      || expectedHash.length !== 64
      || expectedHash.toString("hex") !== parts[2]
    ) {
      return false;
    }

    const actualHash = scryptSync(password, salt, 64);
    if (actualHash.length !== expectedHash.length) return false;
    return timingSafeEqual(actualHash, expectedHash);
  } catch {
    return false;
  }
}
