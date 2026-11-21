import { getAuthAdminStartUrl } from "./auth-admin-start.mjs";
import { getAdminInvitationMessage } from "./admin-invitation-messages.mjs";

export const ADMIN_INVITATION_GOOGLE_START_ERROR_MESSAGE =
  getAdminInvitationMessage("unavailable");

export async function runStartAdminInvitationGoogle({
  getHostContext,
  getToken,
  createTicket,
  getCentralHost,
  secure,
}) {
  const action = getAuthAdminStartUrl(getCentralHost(), { secure });
  if (action === null) {
    return { ok: false, message: ADMIN_INVITATION_GOOGLE_START_ERROR_MESSAGE };
  }

  let hostContext;
  try {
    hostContext = await getHostContext();
  } catch {
    return { ok: false, message: ADMIN_INVITATION_GOOGLE_START_ERROR_MESSAGE };
  }
  if (hostContext?.kind !== "super") {
    return { ok: false, message: ADMIN_INVITATION_GOOGLE_START_ERROR_MESSAGE };
  }

  let token;
  try {
    token = typeof getToken === "function" ? await getToken() : getToken;
  } catch {
    return { ok: false, message: ADMIN_INVITATION_GOOGLE_START_ERROR_MESSAGE };
  }
  if (typeof token !== "string" || token.length === 0) {
    return { ok: false, message: ADMIN_INVITATION_GOOGLE_START_ERROR_MESSAGE };
  }

  let ticket;
  try {
    ticket = await createTicket(token);
  } catch {
    return { ok: false, message: ADMIN_INVITATION_GOOGLE_START_ERROR_MESSAGE };
  }
  if (typeof ticket !== "string" || ticket.length === 0) {
    return { ok: false, message: ADMIN_INVITATION_GOOGLE_START_ERROR_MESSAGE };
  }

  return { ok: true, action, ticket, kind: "invitation" };
}
