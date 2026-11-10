export type ReturnDecision =
  | { action: "redirect"; path: string }
  | { action: "session"; userId: string };

export function getReturnCode(searchParams: URLSearchParams): string | null;

export function resolveReturnDecision(input: {
  code: string | null;
  universityId: string | null;
  consumeResult: { userId: string } | null;
}): ReturnDecision;
