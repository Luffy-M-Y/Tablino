export function validateBurkinaPhone(raw) {
  if (typeof raw !== "string") {
    return {
      ok: false,
      error: "Le numéro de téléphone est obligatoire.",
    };
  }

  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return {
      ok: false,
      error: "Le numéro de téléphone est obligatoire.",
    };
  }

  if (trimmed.startsWith("+") || trimmed.startsWith("00")) {
    return {
      ok: false,
      error: "L'indicatif (+226) est déjà sélectionné. Saisissez uniquement les 8 chiffres locaux sans indicatif.",
    };
  }

  const stripped = trimmed.replace(/[\s.-]/g, "");

  if (stripped.startsWith("226") && stripped.length === 11) {
    return {
      ok: false,
      error: "L'indicatif (226) est déjà sélectionné. Saisissez uniquement les 8 chiffres locaux sans indicatif.",
    };
  }

  if (!/^\d+$/.test(stripped)) {
    return {
      ok: false,
      error: "Le numéro de téléphone ne doit contenir que des chiffres.",
    };
  }

  if (stripped.length !== 8) {
    return {
      ok: false,
      error: "Le numéro de téléphone pour le Burkina Faso (+226) doit comporter exactement 8 chiffres.",
    };
  }

  return {
    ok: true,
    phone: `+226${stripped}`,
  };
}

export { validateBurkinaPhone as parseAndValidateBurkinaPhone };

