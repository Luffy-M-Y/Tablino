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
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { ok: true, phone: null };
  }

  let normalized = trimmed.replace(/\s+/g, "");
  if (normalized.startsWith("+226")) {
    normalized = normalized.slice(4);
  } else if (normalized.startsWith("00226")) {
    normalized = normalized.slice(5);
  } else if (normalized.startsWith("226") && normalized.length === 11) {
    normalized = normalized.slice(3);
  }

  if (!/^\d{8}$/.test(normalized)) {
    return {
      ok: false,
      error: "Le numéro de téléphone pour le Burkina Faso (+226) doit comporter exactement 8 chiffres.",
    };
  }

  return {
    ok: true,
    phone: `${DEFAULT_PHONE_COUNTRY.indicatif}${normalized}`,
  };
}
