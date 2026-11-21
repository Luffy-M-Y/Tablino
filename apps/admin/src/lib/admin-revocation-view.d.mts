import type { ActiveSuperAdminRow } from "@tablino/db";

export type AdminRevocationRow = {
  id: string;
  email: string | null;
  roleLabel: string;
  isSelf: boolean;
  canRevoke: boolean;
};

export type AdminRevocationActor = {
  id: string;
  role?: string;
  hasPassword?: boolean;
};

export type AdminRevocationViewResult = {
  rows: AdminRevocationRow[];
  actorHasPassword: boolean;
};

export function getAdminRevocationRows(
  actor: AdminRevocationActor | null | undefined,
  admins: readonly ActiveSuperAdminRow[] | null | undefined,
): AdminRevocationViewResult;
