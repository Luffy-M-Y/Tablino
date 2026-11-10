import { validateUniversitySlug } from "./university-slug-validate.mjs";

/**
 * Construit l'URL de retour du sous-domaine tenant après Google OAuth.
 * @param {{ slug: string, rootDomain: string, secure: boolean }} options
 * @returns {string | null} URL absolue ou null si un paramètre est invalide
 */
export function getTenantReturnUrl({ slug, rootDomain, secure }) {
  if (typeof rootDomain !== "string" || rootDomain.length === 0) return null;

  const slugResult = validateUniversitySlug(slug ?? "");
  if (!slugResult.ok) return null;

  // rootDomain doit être un nom d'hôte simple (sans scheme ni path)
  if (
    typeof rootDomain !== "string"
    || !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?::\d{1,5})?$/i.test(rootDomain)
    || rootDomain.includes("://")
    || rootDomain.includes("/")
  ) {
    return null;
  }

  const scheme = secure ? "https" : "http";
  return `${scheme}://${slugResult.slug}.${rootDomain}/auth-central/return`;
}
