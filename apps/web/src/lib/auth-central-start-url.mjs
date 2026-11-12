import { normalizeAuthority } from "./auth-central-host.mjs";

/**
 * Construit l'URL complète de /auth-central/start pour l'hôte central.
 * @param {string | undefined} centralHost - valeur de AUTH_CENTRAL_HOST
 * @param {{ secure: boolean }} options    - true en production (https)
 * @returns {string | null} URL absolue, ou null si l'hôte est absent ou invalide
 */
export function getAuthCentralStartUrl(centralHost, { secure }) {
  const normalized = normalizeAuthority(centralHost);
  if (normalized === null) return null;
  const scheme = secure ? "https" : "http";
  return `${scheme}://${normalized}/auth-central/start`;
}
