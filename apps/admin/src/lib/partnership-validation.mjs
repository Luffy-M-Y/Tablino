export const ALLOWED_OPERATORS = ["Orange Money", "Moov Money"];

export function validatePartnershipInput(input) {
  const errors = {};

  if (!input || typeof input !== "object") {
    return {
      ok: false,
      errors: { form: "Données de formulaire invalides." },
    };
  }

  const operator = typeof input.operator === "string" ? input.operator.trim() : "";
  if (!ALLOWED_OPERATORS.includes(operator)) {
    errors.operator = "Opérateur non reconnu. Choisissez Orange Money ou Moov Money.";
  }

  const holderName = typeof input.holderName === "string" ? input.holderName.trim() : "";
  if (holderName.length < 2 || holderName.length > 100) {
    errors.holderName = "Le nom du titulaire doit comporter entre 2 et 100 caractères.";
  }

  const acceptContract = input.acceptContract === true || input.acceptContract === "on" || input.acceptContract === "true";
  if (!acceptContract) {
    errors.acceptContract = "Vous devez accepter les clauses du contrat pour valider le partenariat.";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: {
      operator,
      holderName,
      acceptContract: true,
    },
  };
}

