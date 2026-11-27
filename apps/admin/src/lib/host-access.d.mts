export type HostDenialReason =
  | "host_context_null"
  | "super_admin_not_on_super_host"
  | "global_admin_not_on_super_host"
  | "global_admin_with_university"
  | "university_admin_not_on_university_host"
  | "university_admin_without_university"
  | "university_mismatch"
  | "unknown_role";

export function getHostDenialReason(
  user: { role: string | null | undefined; universityId: string | null | undefined },
  hostContext: { kind: "super" } | { kind: "signup" } | { kind: "university"; universityId: string } | null,
): HostDenialReason | null;

export function isHostAllowedForUser(
  user: { role: string | null | undefined; universityId: string | null | undefined },
  hostContext: { kind: "super" } | { kind: "signup" } | { kind: "university"; universityId: string } | null,
): boolean;
