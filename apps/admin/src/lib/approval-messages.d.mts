export type ApprovalEmailNotice = {
  type: "success" | "warning";
  text: string;
};

export type ApprovalSuccessNotice = {
  kind: "success";
  successMessage: string;
  emailNotice: ApprovalEmailNotice | null;
};

export type ApprovalErrorNotice = {
  kind: "error";
  errorMessage: string;
};

export type ApprovalNotice = ApprovalSuccessNotice | ApprovalErrorNotice;

export declare function buildApprovalSuccessMessage(
  name: string,
  percentage: string | number,
): string;

export declare function resolveApprovalEmailStatus(
  recipientCount: number,
  sentCount: number,
): "sent" | "failed" | "no_recipients";

export declare function buildApprovalEmailMessage(
  emailStatus: string | null | undefined,
  recipientCount?: number,
): ApprovalEmailNotice | null;

export declare function buildApprovalErrorMessage(reason: string): string;

export declare function parseApprovalNotice(
  params?: Record<string, string | string[] | undefined> | null,
): ApprovalNotice | null;
