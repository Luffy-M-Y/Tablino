import type { RevokeSuperAdminAccountFailureReason } from "@tablino/db";

export type AdminRevocationMessageReason =
  | RevokeSuperAdminAccountFailureReason
  | "success"
  | "unavailable";

export function getAdminRevocationRoleLabel(role: unknown): string | null;
export function getAdminRevocationMessage(reason: string): string;
