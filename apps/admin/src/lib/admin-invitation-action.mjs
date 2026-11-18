import { canRoleUseAdminPermission } from "./admin-permissions.mjs";
import { runAdminInvitationFlow } from "./admin-invitation-flow.mjs";

const INVITATION_PERMISSION = Object.freeze({
  super_admin_editor: "inviteEditor",
  super_admin_lector: "inviteLector",
});

export function getInvitableAdminRoles(actorRole) {
  return Object.entries(INVITATION_PERMISSION)
    .filter(([, permission]) => canRoleUseAdminPermission(actorRole, permission))
    .map(([role]) => role);
}

export async function runAdminInvitationAction({
  actor,
  email,
  role,
  password,
  clientIp,
  rootDomain,
  secure,
  verifyStepUp,
  createInvitation,
  sendEmail,
  enqueueAlerts,
  processAlerts,
}) {
  if (
    typeof role !== "string"
    || !Object.prototype.hasOwnProperty.call(INVITATION_PERMISSION, role)
  ) {
    return { ok: false, reason: "invalid_role" };
  }
  const permission = INVITATION_PERMISSION[role];
  if (!canRoleUseAdminPermission(actor?.role, permission)) {
    return { ok: false, reason: "inviter_not_allowed" };
  }
  if (role === "super_admin_editor") {
    const stepUp = await verifyStepUp(actor.id, password);
    if (!stepUp.ok) {
      return {
        ok: false,
        reason: stepUp.reason === "no_password"
          ? "step_up_no_password"
          : stepUp.reason === "rate_limited"
            ? "step_up_rate_limited"
            : stepUp.reason === "not_allowed"
              ? "inviter_not_allowed"
              : "step_up_invalid",
      };
    }
  }

  return runAdminInvitationFlow({
    email,
    invitedByUserId: actor.id,
    role,
    clientIp,
    rootDomain,
    secure,
    createInvitation,
    sendEmail,
    enqueueAlerts,
    processAlerts,
  });
}
