import { validateUniversitySlug } from "./university-slug-validate.mjs";

/**
 * Construit une URL absolue vers un sous-domaine tenant.
 * @param {{ slug: string, rootDomain: string, secure: boolean, path: string }} options
 * @returns {string | null}
 */
export function buildTenantUrl({ slug, rootDomain, secure, path }) {
  if (typeof rootDomain !== "string" || rootDomain.length === 0) return null;

  const slugResult = validateUniversitySlug(slug ?? "");
  if (!slugResult.ok) return null;

  if (
    typeof rootDomain !== "string"
    || !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?::\d{1,5})?$/i.test(rootDomain)
    || rootDomain.includes("://")
    || rootDomain.includes("/")
  ) {
    return null;
  }

  const scheme = secure ? "https" : "http";
  return `${scheme}://${slugResult.slug}.${rootDomain}/${path}`;
}

/**
 * Construit l'URL de retour du sous-domaine tenant après Google OAuth.
 * Source unique : délègue à buildTenantUrl.
 */
export function getTenantReturnUrl({ slug, rootDomain, secure }) {
  return buildTenantUrl({ slug, rootDomain, secure, path: "auth-central/return" });
}
