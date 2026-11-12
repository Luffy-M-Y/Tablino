export type ReturnDecision =
  | { action: "redirect"; path: string }
  | { action: "session"; userId: string };

export type SessionAllowedDecision =
  | { allowed: true }
  | { allowed: false };

export function getReturnCode(searchParams: URLSearchParams): string | null;

export function resolveReturnDecision(input: {
  code: string | null;
  universityId: string | null;
  consumeResult: { userId: string } | null;
}): ReturnDecision;

export function resolveSessionAllowed(input: {
  userFound: boolean;
  revokedAt: Date | null;
}): SessionAllowedDecision;
