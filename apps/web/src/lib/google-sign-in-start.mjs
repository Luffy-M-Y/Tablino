import { getAuthCentralStartUrl } from "./auth-central-start-url.mjs";

const GENERIC_ERROR = "Impossible de démarrer la connexion. Réessayez.";

/**
 * Fonction pure à dépendances injectables.
 * Testée directement ; enveloppée par la Server Action dans google-sign-in-action.ts.
 * Aucune entrée client : université résolue depuis l'hôte courant uniquement.
 *
 * @param {{
 *   getUniversityId: () => Promise<string>,
 *   createTicket: (universityId: string) => Promise<string>,
 *   getCentralHost: () => string | undefined,
 *   secure: boolean,
 * }} deps
 * @returns {Promise<{ ok: true, action: string, ticket: string }
 *                 | { ok: false, message: string }>}
 */
export async function runStartGoogleSignIn({
  getUniversityId,
  createTicket,
  getCentralHost,
  secure,
}) {
  const action = getAuthCentralStartUrl(getCentralHost(), { secure });
  if (action === null) {
    return { ok: false, message: GENERIC_ERROR };
  }

  let universityId;
  try {
    universityId = await getUniversityId();
  } catch {
    return { ok: false, message: GENERIC_ERROR };
  }

  let ticket;
  try {
    ticket = await createTicket(universityId);
  } catch {
    return { ok: false, message: GENERIC_ERROR };
  }

  return { ok: true, action, ticket };
}
