"use server";

import { getCloudflareClientIp } from "@tablino/auth";
import { checkRateLimit, recordFailure, searchActiveUniversitiesByAcronym } from "@tablino/db";
import { headers } from "next/headers";
import { buildUniversityStudentUrl, isRootSiteHost } from "@/lib/root-site.mjs";
import { TURNSTILE_ERROR_MESSAGE, verifyTurnstileForm } from "@/lib/turnstile";
import { parseUniversityHostSlugMap } from "@/lib/university-host.mjs";

export type VitrineUniversity = {
  name: string;
  acronym: string;
  locality: string | null;
  url: string;
};

export type UniversitySearchState = {
  message: string | null;
  results: VitrineUniversity[] | null;
};

const UNAVAILABLE: UniversitySearchState = {
  message: "Recherche temporairement indisponible.",
  results: null,
};

export async function searchUniversitiesAction(
  _previousState: UniversitySearchState,
  formData: FormData,
): Promise<UniversitySearchState> {
  const requestHeaders = await headers();
  const rootDomain = process.env.ROOT_DOMAIN;
  if (!isRootSiteHost(requestHeaders.get("host"), rootDomain)) return UNAVAILABLE;

  const value = formData.get("acronym");
  const query = typeof value === "string" ? value.trim() : "";
  if (query.length === 0 || query.length > 20) {
    return { message: "Saisissez l’acronyme de votre université (20 caractères au plus).", results: null };
  }

  const clientIp = getCloudflareClientIp(requestHeaders);
  if (clientIp === null && process.env.NODE_ENV === "production") return UNAVAILABLE;
  if (clientIp !== null) {
    const limit = await checkRateLimit("search_ip", clientIp);
    if (!limit.allowed) {
      return { message: "Trop de recherches. Réessaie dans quelques minutes.", results: null };
    }
  }

  if (!(await verifyTurnstileForm(formData, "university_search"))) {
    return { message: TURNSTILE_ERROR_MESSAGE, results: null };
  }
  // Chaque recherche vérifiée compte dans la limite par IP (30 par 15 minutes).
  if (clientIp !== null) await recordFailure("search_ip", clientIp);

  let search;
  try {
    search = await searchActiveUniversitiesByAcronym(query);
  } catch {
    return { message: "Recherche impossible. Réessaie.", results: null };
  }
  if (!search.ok) {
    return { message: "Acronyme invalide : lettres, chiffres et tirets seulement.", results: null };
  }

  const slugMap = parseUniversityHostSlugMap(process.env.UNIVERSITY_HOST_SLUG_MAP);
  const secure = process.env.NODE_ENV === "production";
  const results = search.universities.flatMap((university) => {
    const url = buildUniversityStudentUrl({ slug: university.slug, rootDomain, slugMap, secure });
    return url
      ? [{ name: university.name, acronym: university.acronym, locality: university.locality, url }]
      : [];
  });

  return {
    message: results.length === 0 ? "Aucune université active ne porte cet acronyme." : null,
    results,
  };
}
