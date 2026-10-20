import { connection } from "next/server";

/**
 * Point d'entrée unique pour l'university_id.
 * Variable serveur uniquement — jamais préfixée NEXT_PUBLIC_.
 * À remplacer par identification par sous-domaine (feat/auth-subdomain).
 */
export async function getCurrentUniversityId(): Promise<string> {
  await connection(); // force le rendu dynamique (request-time)
  const id = process.env.UNIVERSITY_ID;
  if (!id) throw new Error("UNIVERSITY_ID manquant dans les variables d'environnement serveur.");
  return id;
}
