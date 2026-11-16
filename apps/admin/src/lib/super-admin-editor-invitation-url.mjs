export function normalizeAdminRootDomain(value) {
  if (typeof value !== "string") return null;
  const domain = value.trim().toLowerCase();
  if (!domain || /[\s/@?#\\]/.test(domain)) return null;

  try {
    const parsed = new URL(`http://${domain}`);
    if (
      parsed.username
      || parsed.password
      || parsed.pathname !== "/"
      || parsed.search
      || parsed.hash
      || parsed.host !== domain
    ) {
      return null;
    }
    return domain;
  } catch {
    return null;
  }
}

export function buildSuperAdminEditorInvitationUrl(rootDomain, token, secure) {
  const domain = normalizeAdminRootDomain(rootDomain);
  if (
    domain === null
    || typeof token !== "string"
    || !/^[A-Za-z0-9_-]{43}$/.test(token)
  ) {
    return null;
  }

  const url = new URL(
    `${secure ? "https" : "http"}://sup-admin.${domain}/admin-invitation/start`,
  );
  url.searchParams.set("token", token);
  return url.toString();
}
