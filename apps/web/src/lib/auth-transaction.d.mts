export const AUTH_TRANSACTION_TTL_MS: number;

export function createAuthTransaction(options: {
  universityId: string;
  now: Date;
  secret: string;
}): string;

export function verifyAuthTransaction(
  value: string | null | undefined,
  options: { now: Date; secret: string | undefined },
): string | null;
