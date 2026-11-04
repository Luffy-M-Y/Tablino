export type ValidateBurkinaPhoneResult =
  | { ok: true; phone: string }
  | { ok: false; error: string };

export function validateBurkinaPhone(raw: unknown): ValidateBurkinaPhoneResult;
export function parseAndValidateBurkinaPhone(raw: unknown): ValidateBurkinaPhoneResult;

