const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,55}[a-z0-9])?$/;
const ADMIN_SUFFIX = "-admin";
const SUPER_ADMIN_HOST_LABEL = "sup-admin";

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
 * Résout un hôte admin en type (super, central, université) ou null.
 *
 * @param {string | null} host - en-tête Host de la requête
 * @param {string} adminRootDomain - domaine racine admin (ex: localhost:3001 ou tablino.com)
 * @param {string | undefined} slugMapJson - JSON optionnel mappant hostSlug → databaseSlug
 * @param {string | undefined} authAdminCentralHost - valeur de AUTH_ADMIN_CENTRAL_HOST
 * @returns {{ kind: "super" } | { kind: "central" } | { kind: "university", slug: string } | null}
 */
export function resolveAdminHost(host, adminRootDomain, slugMapJson, authAdminCentralHost) {
  const hostname = normalizeHost(host);
  if (!hostname) return null;

  const rootHostname = normalizeHost(adminRootDomain);
  if (rootHostname && hostname === rootHostname) return null;

  const centralHostname = normalizeHost(authAdminCentralHost);
  if (centralHostname && hostname === centralHostname) {
    return { kind: "central" };
  }
  if (!rootHostname) return null;

  const superAdminHostname = normalizeHost(`${SUPER_ADMIN_HOST_LABEL}.${rootHostname}`);
  if (hostname === superAdminHostname) {
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

/**
 * Vérifie que l'hôte courant correspond exactement à l'hôte central configuré.
 *
 * @param {string | null} host
 * @param {string | undefined} authAdminCentralHost
 * @returns {boolean}
 */
export function isAuthAdminCentralHost(host, authAdminCentralHost) {
  const hostname = normalizeHost(host);
  const centralHostname = normalizeHost(authAdminCentralHost);
  return hostname !== null && centralHostname !== null && hostname === centralHostname;
}

/**
 * Vérifie si un chemin est disponible sur l'hôte admin résolu.
 *
 * @param {"super" | "central" | "university"} kind
 * @param {string} pathname
 */
export function isAdminProxyPathAllowed(kind, pathname) {
  if (typeof pathname !== "string" || !pathname.startsWith("/")) return false;
  let decodedPathname;
  try {
    decodedPathname = decodeURIComponent(pathname);
  } catch {
    return false;
  }

  if (kind === "central") {
    return decodedPathname.startsWith("/auth-admin/")
      || decodedPathname.startsWith("/api/auth/");
  }

  return decodedPathname !== "/api/auth/signin/google"
    && decodedPathname !== "/api/auth/callback/google";
}

/**
 * Le mot de passe super_admin n'est accepté que sur son hôte dédié.
 *
 * @param {"super_admin" | "university_admin"} role
 * @param {"super" | "university" | null} hostKind
 */
export function isAdminPasswordLoginAllowed(role, hostKind) {
  return role !== "super_admin" || hostKind === "super";
}
