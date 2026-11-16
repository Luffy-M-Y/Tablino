import { buildAdminInvitationUrl, normalizeAdminRootDomain } from "./admin-invitation-url.mjs";

export async function runAdminInvitationFlow({
  email,
  invitedByUserId,
  rootDomain,
  secure,
  createInvitation,
  sendEmail,
  revokeInvitation,
}) {
  const domain = normalizeAdminRootDomain(rootDomain);
  if (domain === null) return { ok: false, reason: "invalid_root_domain" };

  const created = await createInvitation(email, invitedByUserId);
  if (!created.ok) return created;

  const invitationUrl = buildAdminInvitationUrl(
    domain,
    created.token,
    secure,
  );
  if (invitationUrl === null) {
    const revoked = await revokeInvitation(created.invitationId);
    return {
      ok: false,
      reason: revoked ? "invalid_root_domain" : "email_revoke_failed",
    };
  }

  try {
    await sendEmail(created.email, invitationUrl, created.expiresAt, created.role);
    return { ok: true };
  } catch {
    let revoked = false;
    try {
      revoked = await revokeInvitation(created.invitationId);
    } catch {
      revoked = false;
    }
    return {
      ok: false,
      reason: revoked ? "email_failed" : "email_revoke_failed",
    };
  }
}
