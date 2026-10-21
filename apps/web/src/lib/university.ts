import { connection } from "next/server";
import { getCurrentUniversityId as getConfiguredUniversityId } from "@tablino/auth";

/**
 * Point d'entrée unique pour l'university_id.
 * Variable serveur uniquement — jamais préfixée NEXT_PUBLIC_.
 * À remplacer par identification par sous-domaine (feat/auth-subdomain).
 */
export async function getCurrentUniversityId(): Promise<string> {
  await connection(); // force le rendu dynamique (request-time)
  return getConfiguredUniversityId();
}
