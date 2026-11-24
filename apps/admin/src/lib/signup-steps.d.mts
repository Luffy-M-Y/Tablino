export type SignupStepId = "university" | "access" | "account" | "review";

export type SignupStepValues = {
  universityName: string;
  acronym: string;
  locality: string;
  visibility: string;
  phone: string;
  email: string;
  password: string;
  passwordConfirmation: string;
};

export const SIGNUP_STEPS: ReadonlyArray<{ readonly id: SignupStepId; readonly title: string }>;

export function validateSignupStep(step: SignupStepId, values: SignupStepValues): string | null;

export function findFirstInvalidSignupStep(
  values: SignupStepValues,
): { step: Exclude<SignupStepId, "review">; error: string } | null;
