import { validateBurkinaPhone } from "./phone-validation.mjs";

export type PhoneCountry = {
  readonly code: "BF";
  readonly nom: "Burkina Faso";
  readonly indicatif: "+226";
  readonly localDigitsCount: 8;
};

export const PHONE_COUNTRIES: readonly PhoneCountry[] = [
  {
    code: "BF",
    nom: "Burkina Faso",
    indicatif: "+226",
    localDigitsCount: 8,
  },
] as const;

export const DEFAULT_PHONE_COUNTRY: PhoneCountry = PHONE_COUNTRIES[0];

export type ParsePhoneResult =
  | { ok: true; phone: string | null }
  | { ok: false; error: string };

export function parseAndValidateBurkinaPhone(raw: string): ParsePhoneResult {
  return validateBurkinaPhone(raw);
}
