export type ErrorRedirectDecision =
  | { action: "render" }
  | { action: "redirect"; url: string };

export function resolveErrorRedirect(input: {
  universityId: string | null;
  slug: string | null;
  rootDomain: string | undefined;
  secure: boolean;
}): ErrorRedirectDecision;
