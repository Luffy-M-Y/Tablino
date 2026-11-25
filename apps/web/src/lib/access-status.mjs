const DAY_MS = 24 * 60 * 60 * 1000;

function isDate(value) {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

/**
 * Statut d'accès d'un étudiant, dans le même ordre que getAccessState :
 * un abonnement en cours prime sur l'essai.
 */
export function describeAccessStatus(user, now) {
  if (user.revokedAt !== null && user.revokedAt !== undefined) return { kind: "revoked" };
  const nowMs = now.getTime();
  const paidUntil = isDate(user.subscriptionExpiresAt) ? user.subscriptionExpiresAt : null;
  const trialEndsAt = isDate(user.trialEndsAt) ? user.trialEndsAt : null;

  if (paidUntil !== null && paidUntil.getTime() > nowMs) return { kind: "pro", endsAt: paidUntil };
  if (trialEndsAt !== null && trialEndsAt.getTime() > nowMs) {
    return { kind: "trial", endsAt: trialEndsAt, daysLeft: Math.ceil((trialEndsAt.getTime() - nowMs) / DAY_MS) };
  }

  const ended = [paidUntil, trialEndsAt].filter((date) => date !== null);
  if (ended.length > 0) {
    return { kind: "expired", endedAt: new Date(Math.max(...ended.map((date) => date.getTime()))) };
  }
  return { kind: "none" };
}

/** Libellé court de la barre du haut, ou null quand aucun statut ne s'affiche. */
export function accessStatusLabel(status) {
  if (status.kind === "pro") return "Pro";
  if (status.kind === "trial") return `Essai gratuit · ${status.daysLeft} j`;
  return null;
}

/** Libellé complet pour les lecteurs d'écran. */
export function accessStatusSpokenLabel(status) {
  if (status.kind === "pro") return "Statut de l'accès : Pro";
  if (status.kind === "trial") {
    const unit = status.daysLeft > 1 ? "jours restants" : "jour restant";
    return `Statut de l'accès : essai gratuit, ${status.daysLeft} ${unit}`;
  }
  return null;
}

export function formatAccessDate(date) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Africa/Ouagadougou",
  }).format(date);
}
