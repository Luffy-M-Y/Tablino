export type HostDenialReason =
  | "host_context_null"
  | "super_admin_not_on_super_host"
  | "university_admin_not_on_university_host"
  | "university_admin_without_university"
  | "university_mismatch"
  | "unknown_role";

export function getHostDenialReason(
  user: { role: string | null | undefined; universityId: string | null | undefined },
  hostContext: { kind: "super" } | { kind: "university"; universityId: string } | null,
): HostDenialReason | null;

export function isHostAllowedForUser(
  user: { role: string | null | undefined; universityId: string | null | undefined },
  hostContext: { kind: "super" } | { kind: "university"; universityId: string } | null,
): boolean;
