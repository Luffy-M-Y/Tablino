import { buildTenantUrl } from "./tenant-return-url.mjs";

/**
 * Décide de l'action de la page d'erreur centrale à partir des entrées pures.
 * Aucun effet de bord : la redirection reste du ressort de l'appelant.
 *
 * @param {{ universityId: string | null, slug: string | null, rootDomain: string | undefined, secure: boolean }} input
 * @returns {{ action: "render" } | { action: "redirect", url: string }}
 */
export function resolveErrorRedirect({ universityId, slug, rootDomain, secure }) {
  if (!universityId) return { action: "render" };
  if (!slug) return { action: "render" };
  if (!rootDomain) return { action: "render" };
  const url = buildTenantUrl({ slug, rootDomain, secure, path: "connexion?authError=1" });
  if (!url) return { action: "render" };
  return { action: "redirect", url };
}
