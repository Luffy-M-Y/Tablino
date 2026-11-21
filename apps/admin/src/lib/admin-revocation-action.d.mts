import type {
  RevokeSuperAdminAccountFailureReason,
  RevokeSuperAdminAccountInput,
  RevokeSuperAdminAccountResult,
} from "@tablino/db";

export type AdminRevocationActionResult =
  | { ok: true; reason: "success" }
  | { ok: false; reason: RevokeSuperAdminAccountFailureReason };

export type AdminRevocationActionInput = {
  actor: { id: string; role?: string } | null | undefined;
  targetId: unknown;
  password: unknown;
  revokeAccount: (
    input: RevokeSuperAdminAccountInput,
  ) => Promise<RevokeSuperAdminAccountResult>;
  enqueueAlerts?: (auditId: string) => Promise<unknown>;
  processAlerts?: () => Promise<unknown>;
};

export function runAdminRevocationAction(
  input: AdminRevocationActionInput,
): Promise<AdminRevocationActionResult>;
