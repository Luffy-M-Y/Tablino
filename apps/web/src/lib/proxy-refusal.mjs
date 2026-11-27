import { isAuthCentralHost } from "./auth-central-host.mjs";
import { inspectUniversityHost } from "./university-host.mjs";

/** Route serveur à serveur, indépendante de l'hôte (webhook GeniusPay). */
const HOST_INDEPENDENT_PATHS = new Set(["/api/paiement/geniuspay/webhook"]);

/**
 * Refus du proxy, sans base de données : 404 pour un hôte mal formé
 * (ni université, ni domaine racine, ni hôte central).
 * Un sous-domaine bien formé sans université reste servi (« Adresse inconnue »).
 * TRACE n'arrive jamais ici : Next le rejette avant le proxy (mesuré, 500).
 */
export function decideProxyRefusal({ host, pathname, rootDomain, authCentralHost }) {
  if (HOST_INDEPENDENT_PATHS.has(pathname)) return null;
  if (isAuthCentralHost(host, authCentralHost)) return null;
  if (typeof rootDomain !== "string" || rootDomain === "") return null;
  return inspectUniversityHost(host, rootDomain).reason === "invalid_host" ? 404 : null;
}
