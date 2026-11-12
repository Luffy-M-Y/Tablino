export const AUTH_CENTRAL_ROUTE_HEADER = "x-tablino-auth-central-route";

export function normalizeAuthority(authority) {
  if (
    typeof authority !== "string"
    || authority.length === 0
    || authority !== authority.trim()
    || /[\s,/@\\?#]/.test(authority)
  ) {
    return null;
  }

  const match = /^(\[[^\]]+\]|[^:]+)(?::([0-9]+))?$/.exec(authority);
  if (!match) return null;

  let url;
  try {
    url = new URL(`http://${authority}`);
  } catch {
    return null;
  }

  if (!url.hostname || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    return null;
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!hostname) return null;

  if (match[2] !== undefined) {
    const port = Number(match[2]);
    if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
    return `${hostname}:${port}`;
  }

  return hostname;
}

export function isAuthCentralHost(host, configuredHost) {
  const normalizedHost = normalizeAuthority(host);
  const normalizedConfiguredHost = normalizeAuthority(configuredHost);
  return normalizedHost !== null && normalizedHost === normalizedConfiguredHost;
}

export function isAuthCentralPath(pathname) {
  return pathname === "/auth-central" || pathname.startsWith("/auth-central/");
}

export function shouldBypassTenantResolution(host, pathname, configuredHost) {
  return isAuthCentralHost(host, configuredHost) && isAuthCentralPath(pathname);
}
