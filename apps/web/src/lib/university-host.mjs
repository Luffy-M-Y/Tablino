const UNIVERSITY_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const DATABASE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function getHostname(authority) {
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
    return url.hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function parseUniversityHostSlugMap(value) {
  if (!value) return {};

  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("UNIVERSITY_HOST_SLUG_MAP doit contenir un objet JSON valide.");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("UNIVERSITY_HOST_SLUG_MAP doit contenir un objet JSON.");
  }

  for (const [hostSlug, databaseSlug] of Object.entries(parsed)) {
    if (
      !UNIVERSITY_SLUG_PATTERN.test(hostSlug)
      || typeof databaseSlug !== "string"
      || databaseSlug.length > 100
      || !DATABASE_SLUG_PATTERN.test(databaseSlug)
    ) {
      throw new Error("UNIVERSITY_HOST_SLUG_MAP contient une correspondance invalide.");
    }
  }

  return parsed;
}

export function inspectUniversityHost(host, rootDomain) {
  const hostname = getHostname(host);
  if (!hostname) return { hostSlug: null, reason: "invalid_host" };

  const rootHostname = getHostname(rootDomain);
  if (!rootHostname) return { hostSlug: null, reason: "invalid_root_domain" };
  if (hostname === rootHostname) return { hostSlug: null, reason: "root_domain" };

  const suffix = `.${rootHostname}`;
  if (!hostname.endsWith(suffix)) return { hostSlug: null, reason: "invalid_host" };

  const hostSlug = hostname.slice(0, -suffix.length);
  if (!UNIVERSITY_SLUG_PATTERN.test(hostSlug)) return { hostSlug: null, reason: "invalid_host" };
  return { hostSlug, reason: null };
}

export function getUniversitySlugFromHost(host, rootDomain, slugMap = {}) {
  const { hostSlug } = inspectUniversityHost(host, rootDomain);
  if (!hostSlug) return null;
  return Object.hasOwn(slugMap, hostSlug) ? slugMap[hostSlug] : hostSlug;
}

export async function resolveUniversityIdFromHost(host, rootDomain, findUniversityBySlug, slugMap = {}) {
  const slug = getUniversitySlugFromHost(host, rootDomain, slugMap);
  if (!slug) return null;

  const university = await findUniversityBySlug(slug);
  if (!university || university.status !== "active") return null;
  return university.id;
}

export function isUniversityAccessAllowed(sessionUniversityId, requestedUniversityId, hostUniversityId) {
  return Boolean(
    sessionUniversityId
    && requestedUniversityId
    && hostUniversityId
    && sessionUniversityId === requestedUniversityId
    && requestedUniversityId === hostUniversityId,
  );
}
