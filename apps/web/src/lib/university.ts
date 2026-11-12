import "server-only";

import { db, eq, schema } from "@tablino/db";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";
import {
  inspectUniversityHost,
  parseUniversityHostSlugMap,
} from "./university-host.mjs";

type TenantResolutionReason =
  | "invalid_host"
  | "root_domain"
  | "invalid_root_domain"
  | "mapping_absent"
  | "mapping_invalid"
  | "unknown_slug"
  | "inactive_university"
  | "database_error";

function logTenantResolutionRefusal(
  reason: TenantResolutionReason,
  host: string | null,
  slug: string | null,
): void {
  if (process.env.NODE_ENV !== "development") return;
  console.warn(JSON.stringify({
    code: "tenant_resolution_refused",
    reason,
    host: typeof host === "string" ? host.slice(0, 255) : null,
    slug,
  }));
}

export const getCurrentUniversityIdOrNull = cache(async (): Promise<string | null> => {
  const host = (await headers()).get("host");
  const rootDomain = process.env.ROOT_DOMAIN;
  if (!rootDomain) {
    logTenantResolutionRefusal("invalid_root_domain", host, null);
    throw new Error("ROOT_DOMAIN manquant dans les variables serveur.");
  }

  const hostInspection = inspectUniversityHost(host, rootDomain);
  let slugMap: Readonly<Record<string, string>>;
  try {
    slugMap = parseUniversityHostSlugMap(process.env.UNIVERSITY_HOST_SLUG_MAP);
  } catch (error) {
    logTenantResolutionRefusal("mapping_invalid", host, hostInspection.hostSlug);
    throw error;
  }

  if (hostInspection.reason) {
    logTenantResolutionRefusal(hostInspection.reason, host, null);
    return null;
  }

  const hasMapping = Object.hasOwn(slugMap, hostInspection.hostSlug);
  const slug = hasMapping ? slugMap[hostInspection.hostSlug] : hostInspection.hostSlug;

  let university: { id: string; status: string } | undefined;
  try {
    [university] = await db
      .select({ id: schema.universities.id, status: schema.universities.status })
      .from(schema.universities)
      .where(eq(schema.universities.slug, slug))
      .limit(1);
  } catch (error) {
    logTenantResolutionRefusal("database_error", host, slug);
    throw error;
  }

  if (!university) {
    logTenantResolutionRefusal(hasMapping ? "unknown_slug" : "mapping_absent", host, slug);
    return null;
  }
  if (university.status !== "active") {
    logTenantResolutionRefusal("inactive_university", host, slug);
    return null;
  }
  return university.id;
});

export async function getCurrentUniversityId(): Promise<string> {
  const universityId = await getCurrentUniversityIdOrNull();
  if (!universityId) notFound();
  return universityId;
}
