const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * @param {object} params
 * @param {{ id: string; role?: string } | null | undefined} params.actor
 * @param {unknown} params.targetId
 * @param {unknown} params.password
 * @param {(input: { actorId: string; targetId: string; password: unknown }) => Promise<import("@tablino/db").RevokeSuperAdminAccountResult>} params.revokeAccount
 * @param {((auditId: string) => Promise<unknown>) | undefined} [params.enqueueAlerts]
 * @param {(() => Promise<unknown>) | undefined} [params.processAlerts]
 * @returns {Promise<{ ok: true; reason: "success" } | { ok: false; reason: import("@tablino/db").RevokeSuperAdminAccountFailureReason }>}
 */
export async function runAdminRevocationAction({
  actor,
  targetId,
  password,
  revokeAccount,
  enqueueAlerts,
  processAlerts,
}) {
  if (typeof targetId !== "string" || !UUID_REGEX.test(targetId)) {
    return { ok: false, reason: "target_not_found" };
  }

  if (typeof password !== "string" || password.length < 1 || password.length > 256) {
    return { ok: false, reason: "invalid_password" };
  }

  if (!actor || typeof actor.id !== "string" || !actor.id) {
    return { ok: false, reason: "not_allowed" };
  }

  const result = await revokeAccount({
    actorId: actor.id,
    targetId,
    password,
  });

  if (!result.ok) {
    return { ok: false, reason: result.reason };
  }

  try {
    if (typeof enqueueAlerts === "function") {
      await enqueueAlerts(result.auditId);
    }
    if (typeof processAlerts === "function") {
      await processAlerts();
    }
  } catch {
    // Un échec d'alerte n'empêche pas la réussite de la révocation du compte.
  }

  return { ok: true, reason: "success" };
}
