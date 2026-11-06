export const ALLOWED_OPERATORS: readonly ["Orange Money", "Moov Money"];
export type AllowedOperator = (typeof ALLOWED_OPERATORS)[number];

export type PartnershipValidationInput = {
  operator?: unknown;
  holderName?: unknown;
  acceptContract?: unknown;
};

export type PartnershipValidationSuccess = {
  ok: true;
  data: {
    operator: AllowedOperator;
    holderName: string;
    acceptContract: true;
  };
};

export type PartnershipValidationFailure = {
  ok: false;
  errors: Record<string, string>;
};

export type PartnershipValidationResult =
  | PartnershipValidationSuccess
  | PartnershipValidationFailure;

export function validatePartnershipInput(input: PartnershipValidationInput): PartnershipValidationResult;

