import { createHash, randomInt } from "node:crypto";

export const ACCESS_CODE_TTL_HOURS = 24;
export const ACCESS_CODE_LENGTH = 12;
export const ACCESS_CODE_MAX_USES_LIMIT = 5000;
export const ACCESS_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export type AccessCodeStatus = "usable" | "revoked" | "expired" | "exhausted";

export function generateAccessCode(): string {
  let code = "";

  for (let index = 0; index < ACCESS_CODE_LENGTH; index++) {
    code += ACCESS_CODE_ALPHABET[randomInt(ACCESS_CODE_ALPHABET.length)];
  }

  return code.slice(0, 4) + "-" + code.slice(4, 8) + "-" + code.slice(8, 12);
}

export function normalizeAccessCode(input: string): string {
  return input.trim().toUpperCase().split("-").join("").split(" ").join("");
}

export function isAccessCodeFormatValid(normalized: string): boolean {
  return normalized.length === ACCESS_CODE_LENGTH
    && Array.from(normalized).every((character) => ACCESS_CODE_ALPHABET.includes(character));
}

export function hashAccessCode(input: string): string {
  return createHash("sha256").update(normalizeAccessCode(input)).digest("hex");
}

export function isMaxUsesValid(value: unknown): value is number {
  return typeof value === "number"
    && Number.isInteger(value)
    && value >= 1
    && value <= ACCESS_CODE_MAX_USES_LIMIT;
}

export function computeAccessCodeExpiry(now: Date): Date {
  return new Date(now.getTime() + ACCESS_CODE_TTL_HOURS * 60 * 60 * 1000);
}

export function getAccessCodeStatus(
  row: { expiresAt: Date; revokedAt: Date | null; usesCount: number; maxUses: number },
  now: Date,
): AccessCodeStatus {
  if (row.revokedAt !== null) return "revoked";
  if (row.expiresAt.getTime() <= now.getTime()) return "expired";
  if (row.usesCount >= row.maxUses) return "exhausted";
  return "usable";
}
