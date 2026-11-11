/**
 * Extrait le code de transfert depuis les query params d'une URL de retour.
 * @param {URLSearchParams} searchParams
 * @returns {string | null}
 */
export function getReturnCode(searchParams) {
  if (!(searchParams instanceof URLSearchParams)) return null;
  const code = searchParams.get("code");
  if (typeof code !== "string" || code.length === 0) return null;
  return code;
}

/**
 * Décide de l'action de la route de retour à partir des entrées pures.
 * Aucun effet de bord : la consommation et la création de session restent
 * du ressort de l'appelant.
 *
 * @param {{ code: string | null, universityId: string | null, consumeResult: { userId: string } | null }} input
 * @returns {{ action: "redirect", path: string } | { action: "session", userId: string }}
 */
export function resolveReturnDecision({ code, universityId, consumeResult }) {
  if (code === null) return { action: "redirect", path: "/connexion" };
  if (universityId === null) return { action: "redirect", path: "/connexion" };
  if (consumeResult === null) return { action: "redirect", path: "/connexion" };
  return { action: "session", userId: consumeResult.userId };
}

/**
 * Décide si une session peut être créée pour un utilisateur, selon
 * son existence et son statut de révocation.
 *
 * @param {{ userFound: boolean, revokedAt: Date | null }} input
 * @returns {{ allowed: true } | { allowed: false }}
 */
export function resolveSessionAllowed({ userFound, revokedAt }) {
  if (!userFound) return { allowed: false };
  if (revokedAt !== null) return { allowed: false };
  return { allowed: true };
}
