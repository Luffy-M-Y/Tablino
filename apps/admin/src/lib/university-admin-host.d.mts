export type UniversityAdminHostAccount = {
  role: string | null;
  universityId: string | null;
  revokedAt: Date | null;
  universityStatus?: string | null;
};

export type UniversityAdminHostContext =
  | { kind: "super" }
  | { kind: "signup" }
  | { kind: "university"; universityId: string }
  | null;

export function resolveUniversityAdminHost(
  account: UniversityAdminHostAccount | null,
  hostContext: UniversityAdminHostContext,
): "not_university_admin" | "own_host" | "other_host";

export function resolveForbiddenTarget(
  account: UniversityAdminHostAccount | null,
  hostContext: UniversityAdminHostContext,
): "none" | "pending" | "partnership" | "university_host";
