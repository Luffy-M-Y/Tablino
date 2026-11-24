const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,55}[a-z0-9])?$/;

function normalizeAdminRootDomain(value) {
  if (
    typeof value !== "string"
    || value.length === 0
    || value !== value.trim()
    || value.endsWith(":")
    || /[\s/@\\?#]/.test(value)
  ) {
    return null;
  }

  try {
    const url = new URL(`http://${value}`);
    if (!url.hostname || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
      return null;
    }
    const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
    const labels = hostname.split(".");
    if (
      hostname.length > 253
      || labels.some((label) =>
        label.length > 63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label),
      )
    ) {
      return null;
    }
    const explicitPort = value.match(/:(\d+)$/)?.[1];
    return explicitPort ? `${hostname}:${Number(explicitPort)}` : hostname;
  } catch {
    return null;
  }
}

/**
 * Construit l'URL de retour admin université : https://{slug}-admin.{ADMIN_ROOT_DOMAIN}/auth-admin/return
 *
 * @param {{ slug: string, adminRootDomain: string, secure: boolean }} options
 * @returns {string | null}
 */
export function buildAdminReturnUrl({ slug, adminRootDomain, secure }) {
  if (typeof slug !== "string" || !SLUG_PATTERN.test(slug)) return null;
  const normalizedRootDomain = normalizeAdminRootDomain(adminRootDomain);
  if (normalizedRootDomain === null) return null;

  const scheme = secure ? "https" : "http";
  return `${scheme}://${slug}-admin.${normalizedRootDomain}/auth-admin/return`;
}

/**
 * Construit l'URL de retour super admin : https://sup-admin.{ADMIN_ROOT_DOMAIN}/auth-admin/return
 *
 * @param {{ adminRootDomain: string, secure: boolean }} options
 * @returns {string | null}
 */
export function buildSuperAdminReturnUrl({ adminRootDomain, secure }) {
  const normalizedRootDomain = normalizeAdminRootDomain(adminRootDomain);
  if (normalizedRootDomain === null) return null;

  const scheme = secure ? "https" : "http";
  return `${scheme}://sup-admin.${normalizedRootDomain}/auth-admin/return`;
}

/**
 * Construit l'URL de connexion admin université : https://{slug}-admin.{ADMIN_ROOT_DOMAIN}/login
 *
 * @param {{ slug: string, adminRootDomain: string, secure: boolean }} options
 * @returns {string | null}
 */
export function buildAdminLoginUrl({ slug, adminRootDomain, secure }) {
  const returnUrl = buildAdminReturnUrl({ slug, adminRootDomain, secure });
  if (returnUrl === null) return null;

  const url = new URL(returnUrl);
  url.pathname = "/login";
  return url.toString();
}

/**
 * Construit l'URL de connexion avec un jeton de compte Google existant.
 *
 * @param {{ slug: string, adminRootDomain: string, secure: boolean, token: string }} options
 * @returns {string | null}
 */
export function buildAdminGoogleExistingAccountUrl({
  slug,
  adminRootDomain,
  secure,
  token,
}) {
  if (typeof token !== "string" || token.length === 0) return null;
  const returnUrl = buildAdminReturnUrl({ slug, adminRootDomain, secure });
  if (returnUrl === null) return null;

  const url = new URL(returnUrl);
  url.pathname = "/login";
  url.searchParams.set("googleExisting", token);
  return url.toString();
}

/**
 * Construit l'URL de connexion super admin avec un jeton de compte Google existant.
 *
 * @param {{ adminRootDomain: string, secure: boolean, token: string }} options
 * @returns {string | null}
 */
export function buildSuperAdminGoogleExistingAccountUrl({
  adminRootDomain,
  secure,
  token,
}) {
  if (typeof token !== "string" || token.length === 0) return null;
  const returnUrl = buildSuperAdminReturnUrl({ adminRootDomain, secure });
  if (returnUrl === null) return null;

  const url = new URL(returnUrl);
  url.pathname = "/login";
  url.searchParams.set("googleExisting", token);
  return url.toString();
}

/**
 * Construit l'URL de transfert université avec le code.
 *
 * @param {{ slug: string, adminRootDomain: string, secure: boolean, code: string }} options
 * @returns {string | null}
 */
export function buildAdminTransferRedirectUrl({ slug, adminRootDomain, secure, code }) {
  if (typeof code !== "string" || code.length === 0) return null;
  const baseUrl = buildAdminReturnUrl({ slug, adminRootDomain, secure });
  if (baseUrl === null) return null;
  return `${baseUrl}?code=${encodeURIComponent(code)}`;
}

/**
 * Construit l'URL de transfert super admin avec le code et optionnellement le flow.
 *
 * @param {{ adminRootDomain: string, secure: boolean, code: string, flow?: string }} options
 * @returns {string | null}
 */
export function buildSuperAdminTransferRedirectUrl({ adminRootDomain, secure, code, flow }) {
  if (typeof code !== "string" || code.length === 0) return null;
  const baseUrl = buildSuperAdminReturnUrl({ adminRootDomain, secure });
  if (baseUrl === null) return null;

  const params = new URLSearchParams({ code });
  if (typeof flow === "string" && flow.length > 0) {
    params.set("flow", flow);
  }
  return `${baseUrl}?${params.toString()}`;
}
