import { resolveAdminHost } from "./admin-host.mjs";

/**
 * Retourne le hostname attendu pour Turnstile à partir de l'hôte de la requête.
 * Utilise resolveAdminHost pour valider l'hôte admin. Fonction pure.
 *
 * @param {string | null} host - en-tête Host de la requête
 * @param {string | undefined} adminRootDomain - valeur de ADMIN_ROOT_DOMAIN
 * @param {string | undefined} slugMapJson - valeur de ADMIN_HOST_SLUG_MAP
 * @returns {string | null} hostname seul (sans port, minuscules) ou null
 */
export function getAdminTurnstileExpectedHostname(
  host,
  adminRootDomain,
  slugMapJson,
  authAdminCentralHost,
) {
  if (!adminRootDomain) return null;

  const resolution = resolveAdminHost(host, adminRootDomain, slugMapJson, authAdminCentralHost);
  if (resolution === null || resolution.kind === "central") return null;

  try {
    return new URL(`http://${host}`).hostname.toLowerCase();
  } catch {
    return null;
  }
}
