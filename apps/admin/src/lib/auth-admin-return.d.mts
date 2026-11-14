export const AUTH_ADMIN_RETURN_ERROR_PATH: "/login?error=google";

export type AdminReturnHostContext =
  | { kind: "super" }
  | { kind: "university"; universityId: string }
  | null;

export type AdminReturnUser = {
  id: string;
  role: string;
  universityId: string | null;
  revokedAt: Date | null;
};

export function getAuthAdminReturnCode(searchParams: URLSearchParams): string | null;

export function resolveAuthAdminReturnDecision(input: {
  code: string | null;
  hostContext: AdminReturnHostContext;
  consumeResult: { userId: string } | null;
  user: AdminReturnUser | null;
}):
  | { action: "redirect"; path: typeof AUTH_ADMIN_RETURN_ERROR_PATH }
  | { action: "session"; userId: string };
