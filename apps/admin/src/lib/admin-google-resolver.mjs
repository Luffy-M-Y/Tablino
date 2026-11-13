import { verifyAuthAdminTransaction } from "./auth-admin-transaction.mjs";

function normalizeHost(authority) {
  if (typeof authority !== "string" || authority.length === 0 || authority !== authority.trim()) return null;
  if (/[\s,/@\\?#]/.test(authority)) return null;
  try {
    const url = new URL(`http://${authority}`);
    if (!url.hostname || url.username || url.password || url.pathname !== "/" || url.search || url.hash) return null;
    const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
    if (!hostname) return null;
    return url.port ? `${hostname}:${url.port}` : hostname;
  } catch { return null; }
}

/**
 * Résolveur d'université pour le flux Google central admin.
 */
export function createAdminGoogleUniversityResolver({
  getHost,
  getAuthAdminCentralHost,
  getCookie,
  getSecret,
  now = () => new Date(),
}) {
  return async function resolveAdminGoogleUniversityId() {
    const host = await getHost();
    const centralHost = getAuthAdminCentralHost();
    const h = normalizeHost(host);
    const c = normalizeHost(centralHost);
    if (h === null || c === null || h !== c) return null;

    const cookie = await getCookie();
    return verifyAuthAdminTransaction(cookie, { now: now(), secret: getSecret() });
  };
}
