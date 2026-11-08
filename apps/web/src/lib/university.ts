import "server-only";

import { db, eq, schema } from "@tablino/db";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";
import {
  getUniversitySlugFromHost,
  parseUniversityHostSlugMap,
} from "./university-host.mjs";

export const getCurrentUniversityIdOrNull = cache(async (): Promise<string | null> => {
  const host = (await headers()).get("host");
  const rootDomain = process.env.ROOT_DOMAIN;
  if (!rootDomain) throw new Error("ROOT_DOMAIN manquant dans les variables serveur.");

  const slugMap = parseUniversityHostSlugMap(process.env.UNIVERSITY_HOST_SLUG_MAP);
  const slug = getUniversitySlugFromHost(host, rootDomain, slugMap);
  if (!slug) return null;

  const [university] = await db
    .select({ id: schema.universities.id, status: schema.universities.status })
    .from(schema.universities)
    .where(eq(schema.universities.slug, slug))
    .limit(1);

  if (!university || university.status !== "active") return null;
  return university.id;
});

export async function getCurrentUniversityId(): Promise<string> {
  const universityId = await getCurrentUniversityIdOrNull();
  if (!universityId) notFound();
  return universityId;
}
