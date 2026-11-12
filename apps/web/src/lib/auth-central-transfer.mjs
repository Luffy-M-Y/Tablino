import { getTenantReturnUrl } from "./tenant-return-url.mjs";

/**
 * Construit l'URL de redirection vers le sous-domaine tenant avec le code
 * de transfert. Le code est en query param ; l'URL de base est validée par
 * getTenantReturnUrl (slug + rootDomain). Aucun code n'est inclus si un
 * paramètre est invalide.
 *
 * @param {{ slug: string, rootDomain: string, secure: boolean, code: string }} options
 * @returns {string | null}
 */
export function buildTransferRedirectUrl({ slug, rootDomain, secure, code }) {
  if (typeof code !== "string" || code.length === 0) return null;
  const baseUrl = getTenantReturnUrl({ slug, rootDomain, secure });
  if (baseUrl === null) return null;
  return `${baseUrl}?code=${encodeURIComponent(code)}`;
}
