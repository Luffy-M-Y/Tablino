const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,55}[a-z0-9])?$/;
const ADMIN_SUFFIX = "-admin";

function normalizeHost(authority) {
  if (
    typeof authority !== "string"
    || authority.length === 0
    || authority !== authority.trim()
    || /[\s,/@\\?#]/.test(authority)
  ) {
    return null;
  }

  try {
    const url = new URL(`http://${authority}`);
    if (!url.hostname || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
      return null;
    }
    const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
    if (!hostname) return null;
    return url.port ? `${hostname}:${url.port}` : hostname;
  } catch {
    return null;
  }
}

function parseHostSlugMap(value) {
  if (!value) return {};
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("ADMIN_HOST_SLUG_MAP doit contenir un objet JSON valide.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("ADMIN_HOST_SLUG_MAP doit contenir un objet JSON.");
  }
  for (const [hostSlug, databaseSlug] of Object.entries(parsed)) {
    if (
      !SLUG_PATTERN.test(hostSlug)
      || typeof databaseSlug !== "string"
      || databaseSlug.length > 100
      || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(databaseSlug)
    ) {
      throw new Error("ADMIN_HOST_SLUG_MAP contient une correspondance invalide.");
    }
  }
  return parsed;
}

/**
 * Résout un hôte admin en type (super, université) ou null.
 *
 * @param {string | null} host - en-tête Host de la requête
 * @param {string} adminRootDomain - domaine racine admin (ex: localhost:3001 ou tablino.com)
 * @param {string | undefined} slugMapJson - JSON optionnel mappant hostSlug → databaseSlug
 * @returns {{ kind: "super" } | { kind: "university", slug: string } | null}
 */
export function resolveAdminHost(host, adminRootDomain, slugMapJson) {
  const hostname = normalizeHost(host);
  if (!hostname) return null;

  const rootHostname = normalizeHost(adminRootDomain);
  if (!rootHostname) return null;

  // Hôte racine = super_admin
  if (hostname === rootHostname) {
    return { kind: "super" };
  }

  const suffix = `.${rootHostname}`;
  if (!hostname.endsWith(suffix)) return null;

  const subdomain = hostname.slice(0, -suffix.length);
  if (!subdomain.endsWith(ADMIN_SUFFIX)) return null;

  const hostSlug = subdomain.slice(0, -ADMIN_SUFFIX.length);
  if (!SLUG_PATTERN.test(hostSlug)) return null;

  let slugMap;
  try {
    slugMap = parseHostSlugMap(slugMapJson);
  } catch {
    return null;
  }

  const slug = Object.hasOwn(slugMap, hostSlug) ? slugMap[hostSlug] : hostSlug;

  return { kind: "university", slug };
}
