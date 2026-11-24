export type RegisterStepId = "identity" | "account" | "accessCode" | "review";

export type RegisterStep = { readonly id: RegisterStepId; readonly title: string };

export type RegisterStepValues = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  passwordConfirmation: string;
  accessCode: string;
};

export function getRegisterSteps(requiresAccessCode: boolean): ReadonlyArray<RegisterStep>;

export function validateRegisterStep(step: RegisterStepId, values: RegisterStepValues): string | null;

export function findFirstInvalidRegisterStep(
  steps: ReadonlyArray<RegisterStep>,
  values: RegisterStepValues,
): { step: Exclude<RegisterStepId, "review">; error: string } | null;
