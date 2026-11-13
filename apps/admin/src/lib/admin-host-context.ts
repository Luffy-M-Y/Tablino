import "server-only";

import { db, eq, schema } from "@tablino/db";
import { headers } from "next/headers";
import { cache } from "react";
import { resolveAdminHost } from "./admin-host.mjs";

export type AdminHostContext =
  | { kind: "super" }
  | { kind: "university"; universityId: string }
  | null;

export const getAdminHostContext = cache(async (): Promise<AdminHostContext> => {
  const host = (await headers()).get("host");
  const adminRootDomain = process.env.ADMIN_ROOT_DOMAIN;
  if (!adminRootDomain) return null;

  const resolution = resolveAdminHost(
    host,
    adminRootDomain,
    process.env.ADMIN_HOST_SLUG_MAP,
    process.env.AUTH_ADMIN_CENTRAL_HOST,
  );
  if (resolution === null || resolution.kind === "central") return null;
  if (resolution.kind === "super") return { kind: "super" };

  const [university] = await db
    .select({ id: schema.universities.id })
    .from(schema.universities)
    .where(eq(schema.universities.slug, resolution.slug))
    .limit(1);

  if (!university) return null;
  return { kind: "university", universityId: university.id };
});
