import { inspectUniversityHost } from "./university-host.mjs";
import { buildTenantUrl } from "./tenant-return-url.mjs";

export const ROOT_SITE_ROUTE_HEADER = "x-tablino-root-site-route";
export const ROOT_SITE_PATH = "/vitrine";

const AUTHORITY_PATTERN = /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?::\d{1,5})?$/i;

/**
 * Vrai seulement pour l'hôte exact du domaine racine (site vitrine).
 * @param {string | null} host
 * @param {string | undefined} rootDomain
 */
export function isRootSiteHost(host, rootDomain) {
  return inspectUniversityHost(host, rootDomain ?? "").reason === "root_domain";
}

/**
 * Nom d'hôte attendu par Turnstile sur le site vitrine, ou null hors du domaine racine.
 * @param {string | null} host
 * @param {string | undefined} rootDomain
 */
export function getRootSiteTurnstileHostname(host, rootDomain) {
  if (!isRootSiteHost(host, rootDomain)) return null;
  return new URL(`http://${host}`).hostname.toLowerCase();
}

/**
 * Slug d'hôte d'une université : inverse de UNIVERSITY_HOST_SLUG_MAP (hôte vers slug en base).
 * Null si le slug, utilisé tel quel, désignerait une autre université.
 * @param {string} databaseSlug
 * @param {Readonly<Record<string, string>>} slugMap
 */
export function getHostSlugForUniversity(databaseSlug, slugMap = {}) {
  if (typeof databaseSlug !== "string" || databaseSlug.length === 0) return null;
  const mappedHostSlugs = Object.keys(slugMap)
    .filter((hostSlug) => slugMap[hostSlug] === databaseSlug)
    .sort();
  if (mappedHostSlugs.length > 0) return mappedHostSlugs[0];
  if (Object.hasOwn(slugMap, databaseSlug)) return null;
  return databaseSlug;
}

/**
 * Lien « accès étudiant » : page de connexion de l'hôte de l'université.
 * @param {{ slug: string, rootDomain: string | undefined, slugMap?: Readonly<Record<string, string>>, secure: boolean }} options
 * @returns {string | null}
 */
export function buildUniversityStudentUrl({ slug, rootDomain, slugMap = {}, secure }) {
  const hostSlug = getHostSlugForUniversity(slug, slugMap);
  if (!hostSlug || typeof rootDomain !== "string") return null;
  return buildTenantUrl({ slug: hostSlug, rootDomain, secure, path: "connexion" });
}

/**
 * Lien « créer mon compte université » : /signup de l'hôte super admin.
 * @param {{ adminRootDomain: string | undefined, secure: boolean }} options
 * @returns {string | null}
 */
export function buildAdminSignupUrl({ adminRootDomain, secure }) {
  if (
    typeof adminRootDomain !== "string"
    || !AUTHORITY_PATTERN.test(adminRootDomain)
  ) {
    return null;
  }
  const scheme = secure ? "https" : "http";
  return `${scheme}://sup-admin.${adminRootDomain.toLowerCase()}/signup`;
}
