import { buildUniversitySlug } from "@tablino/db/university-slug";
import { buildUniversityHostnames } from "./university-hostnames.mjs";

/**
 * Aperçu de l'adresse prévue à l'inscription. Calcul du format seulement :
 * la disponibilité est vérifiée par le serveur à l'envoi du formulaire.
 */
export function buildSignupAddressPreview(acronym, locality, domains) {
  if (typeof acronym !== "string") return { ok: false };
  if (locality !== null && locality !== undefined && typeof locality !== "string") return { ok: false };
  if (
    domains === null
    || typeof domains !== "object"
    || typeof domains.studentRootDomain !== "string"
    || typeof domains.adminRootDomain !== "string"
  ) {
    return { ok: false };
  }

  const trimmedAcronym = acronym.trim();
  if (trimmedAcronym.length === 0 || trimmedAcronym.length > 20) return { ok: false };
  const trimmedLocality = typeof locality === "string" ? locality.trim() : "";
  if (trimmedLocality.length > 60) return { ok: false };

  const slugResult = buildUniversitySlug(trimmedAcronym, trimmedLocality || null);
  if (!slugResult.ok) return { ok: false };

  let hostnames;
  try {
    hostnames = buildUniversityHostnames(slugResult.slug, domains.studentRootDomain, domains.adminRootDomain);
  } catch (error) {
    if (error instanceof TypeError) return { ok: false };
    throw error;
  }
  return { ok: true, slug: slugResult.slug, students: hostnames.students, admin: hostnames.admin };
}
