const IDENTITY = Object.freeze({ id: "identity", title: "Identité" });
const ACCOUNT = Object.freeze({ id: "account", title: "Compte" });
const ACCESS_CODE = Object.freeze({ id: "accessCode", title: "Code d’accès" });
const REVIEW = Object.freeze({ id: "review", title: "Récapitulatif" });

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Étapes de l'inscription étudiante. L'étape du code n'existe que pour une université privée.
 * @param {boolean} requiresAccessCode
 */
export function getRegisterSteps(requiresAccessCode) {
  return Object.freeze(
    requiresAccessCode === false
      ? [IDENTITY, ACCOUNT, REVIEW]
      : [IDENTITY, ACCOUNT, ACCESS_CODE, REVIEW],
  );
}

/**
 * Contrôle d'une étape dans le navigateur. Le serveur revérifie tout à l'envoi.
 * @param {"identity" | "account" | "accessCode" | "review"} step
 * @param {{ firstName: string, lastName: string, email: string, password: string, passwordConfirmation: string, accessCode: string }} values
 * @returns {string | null}
 */
export function validateRegisterStep(step, values) {
  if (step === "identity") {
    const firstName = values.firstName.trim();
    const lastName = values.lastName.trim();
    if (!firstName) return "Le prénom est obligatoire.";
    if (firstName.length > 100) return "Le prénom est trop long (100 caractères au plus).";
    if (!lastName) return "Le nom est obligatoire.";
    if (lastName.length > 100) return "Le nom est trop long (100 caractères au plus).";
    return null;
  }

  if (step === "account") {
    const email = values.email.trim();
    if (!email) return "L’adresse e-mail est obligatoire.";
    if (email.length > 255 || !EMAIL_PATTERN.test(email)) return "L’adresse e-mail est invalide.";
    if (values.password.length < 8 || values.password.length > 128) {
      return "Le mot de passe doit contenir de 8 à 128 caractères.";
    }
    if (values.password !== values.passwordConfirmation) return "Les mots de passe ne correspondent pas.";
    return null;
  }

  if (step === "accessCode") {
    const code = values.accessCode.trim();
    if (!code) return "Le code d’accès est obligatoire.";
    if (code.length > 32) return "Le code d’accès est invalide.";
    return null;
  }

  return null;
}

/**
 * Première étape invalide parmi les étapes données, ou null.
 * @param {ReadonlyArray<{ id: string }>} steps
 * @param {Parameters<typeof validateRegisterStep>[1]} values
 */
export function findFirstInvalidRegisterStep(steps, values) {
  for (const step of steps) {
    if (step.id === "review") return null;
    const error = validateRegisterStep(step.id, values);
    if (error !== null) return { step: step.id, error };
  }
  return null;
}
