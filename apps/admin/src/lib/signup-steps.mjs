import { validateBurkinaPhone } from "./phone-validation.mjs";

/** Étapes de l'inscription d'une université, dans l'ordre. */
export const SIGNUP_STEPS = Object.freeze([
  Object.freeze({ id: "university", title: "Université" }),
  Object.freeze({ id: "access", title: "Accès étudiant" }),
  Object.freeze({ id: "account", title: "Compte" }),
  Object.freeze({ id: "review", title: "Récapitulatif" }),
]);

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Contrôle d'une étape dans le navigateur. Le serveur revérifie tout à l'envoi.
 * @param {"university" | "access" | "account" | "review"} step
 * @param {{ universityName: string, acronym: string, locality: string, visibility: string, phone: string, email: string, password: string, passwordConfirmation: string }} values
 * @returns {string | null} message d'erreur, ou null si l'étape est valide
 */
export function validateSignupStep(step, values) {
  if (step === "university") {
    const name = values.universityName.trim();
    if (!name) return "Le nom de l’université est obligatoire.";
    if (name.length > 255) return "Le nom de l’université est trop long (255 caractères au plus).";
    const acronym = values.acronym.trim();
    if (!acronym) return "L’acronyme de l’université est obligatoire.";
    if (acronym.length > 20) return "L’acronyme est trop long (20 caractères au plus).";
    if (values.locality.trim().length > 60) return "La localité est trop longue (60 caractères au plus).";
    return null;
  }

  if (step === "access") {
    return values.visibility === "private" || values.visibility === "public"
      ? null
      : "Choisissez la visibilité de l’université.";
  }

  if (step === "account") {
    const email = values.email.trim();
    if (!email) return "L’adresse e-mail est obligatoire.";
    if (email.length > 255 || !EMAIL_PATTERN.test(email)) return "L’adresse e-mail est invalide.";
    const phone = validateBurkinaPhone(values.phone);
    if (!phone.ok) return phone.error;
    if (values.password.length < 8 || values.password.length > 128) {
      return "Le mot de passe doit contenir de 8 à 128 caractères.";
    }
    if (values.password !== values.passwordConfirmation) return "Les mots de passe ne correspondent pas.";
    return null;
  }

  return null;
}

/**
 * Première étape invalide avant le récapitulatif, ou null si toutes sont valides.
 * @param {Parameters<typeof validateSignupStep>[1]} values
 */
export function findFirstInvalidSignupStep(values) {
  for (const step of SIGNUP_STEPS) {
    if (step.id === "review") return null;
    const error = validateSignupStep(step.id, values);
    if (error !== null) return { step: step.id, error };
  }
  return null;
}
