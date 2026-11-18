import { buildAdminInvitationUrl, normalizeAdminRootDomain } from "./admin-invitation-url.mjs";

export async function runAdminInvitationFlow({
  email,
  invitedByUserId,
  role,
  clientIp,
  rootDomain,
  secure,
  createInvitation,
  sendEmail,
  enqueueAlerts,
  processAlerts,
}) {
  const domain = normalizeAdminRootDomain(rootDomain);
  if (domain === null) return { ok: false, reason: "invalid_root_domain" };

  const created = await createInvitation(email, invitedByUserId, role, clientIp);
  if (!created.ok) return created;

  const invitationUrl = buildAdminInvitationUrl(
    domain,
    created.token,
    secure,
  );
  let emailSent = false;
  try {
    if (invitationUrl !== null) {
      await sendEmail(created.email, invitationUrl, created.expiresAt, created.role);
      emailSent = true;
    }
  } catch {
    console.error(JSON.stringify({ code: "admin_invitation_email_failed" }));
  }

  try {
    await enqueueAlerts(created.auditId);
    const alertResult = await processAlerts();
    if (
      typeof alertResult === "object"
      && alertResult !== null
      && (
        ("failed" in alertResult && alertResult.failed > 0)
        || ("retried" in alertResult && alertResult.retried > 0)
      )
    ) {
      console.error(JSON.stringify({ code: "admin_invitation_alert_delivery_failed" }));
    }
  } catch {
    console.error(JSON.stringify({ code: "admin_invitation_alert_delivery_failed" }));
  }

  return {
    ok: true,
    emailSent,
    invitationId: created.invitationId,
    sendError: invitationUrl === null ? "invalid_root_domain" : emailSent ? null : "email_failed",
  };
}
