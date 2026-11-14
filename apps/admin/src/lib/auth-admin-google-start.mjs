import { getAuthAdminStartUrl } from "./auth-admin-start.mjs";

export const AUTH_ADMIN_GOOGLE_START_ERROR_MESSAGE =
  "Impossible de démarrer la connexion. Réessayez.";

export async function runStartAdminGoogleSignIn({
  getHostContext,
  createTicket,
  getCentralHost,
  secure,
}) {
  const action = getAuthAdminStartUrl(getCentralHost(), { secure });
  if (action === null) {
    return { ok: false, message: AUTH_ADMIN_GOOGLE_START_ERROR_MESSAGE };
  }

  let hostContext;
  try {
    hostContext = await getHostContext();
  } catch {
    return { ok: false, message: AUTH_ADMIN_GOOGLE_START_ERROR_MESSAGE };
  }
  if (
    hostContext?.kind !== "university"
    || typeof hostContext.universityId !== "string"
    || hostContext.universityId.length === 0
  ) {
    return { ok: false, message: AUTH_ADMIN_GOOGLE_START_ERROR_MESSAGE };
  }

  let ticket;
  try {
    ticket = await createTicket(hostContext.universityId, "admin");
  } catch {
    return { ok: false, message: AUTH_ADMIN_GOOGLE_START_ERROR_MESSAGE };
  }
  if (typeof ticket !== "string" || ticket.length === 0) {
    return { ok: false, message: AUTH_ADMIN_GOOGLE_START_ERROR_MESSAGE };
  }

  return { ok: true, action, ticket };
}
