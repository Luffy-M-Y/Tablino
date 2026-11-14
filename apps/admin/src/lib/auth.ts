import { cookies, headers } from "next/headers";
import { createAuthOptions, getCurrentUniversityId } from "@tablino/auth";
import { db, eq, schema } from "@tablino/db";
import { AUTH_ADMIN_TRANSACTION_COOKIE_NAME } from "./auth-admin-transaction.mjs";
import { createAdminGoogleUniversityResolver } from "./admin-google-resolver.mjs";
import { isAuthAdminCentralHost } from "./admin-host.mjs";
import { buildAdminGoogleExistingAccountUrl } from "./admin-return-url.mjs";

const resolveGoogleUniversityId = createAdminGoogleUniversityResolver({
  getHost: async () => (await headers()).get("host"),
  getAuthAdminCentralHost: () => process.env.AUTH_ADMIN_CENTRAL_HOST,
  getCookie: async () => (await cookies()).get(AUTH_ADMIN_TRANSACTION_COOKIE_NAME)?.value,
  getSecret: () => process.env.NEXTAUTH_SECRET,
});

export function getAdminAuthOptions(host: string | null) {
  return createAuthOptions({
    surface: "admin",
    getCurrentUniversityId,
    resolveGoogleUniversityId,
    resolveGoogleExistingAccountUrl: async (universityId, token) => {
      try {
        const rows = await db
          .select({ slug: schema.universities.slug })
          .from(schema.universities)
          .where(eq(schema.universities.id, universityId))
          .limit(1);
        const adminRootDomain = process.env.ADMIN_ROOT_DOMAIN;
        if (!(rows.length > 0) || !rows[0].slug || !adminRootDomain) return null;
        return buildAdminGoogleExistingAccountUrl({
          slug: rows[0].slug,
          adminRootDomain,
          secure: process.env.NODE_ENV === "production",
          token,
        });
      } catch {
        return null;
      }
    },
    isAuthAdminCentral: isAuthAdminCentralHost(host, process.env.AUTH_ADMIN_CENTRAL_HOST),
  });
}
