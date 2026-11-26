const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

function isLocalHostname(hostname: string): boolean {
  return LOCAL_HOSTNAMES.has(hostname) || hostname.endsWith(".localhost");
}

/**
 * Cookies `Secure` si NEXTAUTH_URL est en https.
 * En production, une URL non https hors hôte local lève une erreur : pas de cookie faible.
 */
export function shouldUseSecureCookies(
  env: { NODE_ENV?: string; NEXTAUTH_URL?: string } = process.env,
): boolean {
  const url = env.NEXTAUTH_URL;
  if (url?.startsWith("https://")) return true;
  if (env.NODE_ENV !== "production") return false;

  let hostname = "";
  try {
    hostname = url ? new URL(url).hostname.toLowerCase() : "";
  } catch {
    hostname = "";
  }
  if (!isLocalHostname(hostname)) {
    throw new Error("NEXTAUTH_URL doit être en https en production.");
  }
  return false;
}
