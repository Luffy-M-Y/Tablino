import { cookies, headers } from "next/headers";
import { createAuthOptions } from "@tablino/auth";
import { db, schema, eq } from "@tablino/db";
import { AUTH_TRANSACTION_COOKIE_NAME } from "./auth-central-start.mjs";
import { createGoogleUniversityResolver } from "./google-university-resolver.mjs";
import { buildTenantUrl } from "./tenant-return-url.mjs";
import { getCurrentUniversityId } from "./university";

export const authOptions = createAuthOptions({
  surface: "web",
  getCurrentUniversityId,
  resolveGoogleUniversityId: createGoogleUniversityResolver({
    getHost: async () => (await headers()).get("host"),
    getAuthCentralHost: () => process.env.AUTH_CENTRAL_HOST,
    getCookie: async () => (await cookies()).get(AUTH_TRANSACTION_COOKIE_NAME)?.value,
    getSecret: () => process.env.NEXTAUTH_SECRET,
    getCurrentUniversityId,
  }),
  resolveGoogleSignupUrl: async (universityId, token) => {
    try {
      const rows = await db
        .select({ slug: schema.universities.slug })
        .from(schema.universities)
        .where(eq(schema.universities.id, universityId))
        .limit(1);
      if (!(rows.length > 0) || !rows[0].slug) return null;
      const rootDomain = process.env.ROOT_DOMAIN;
      if (!rootDomain) return null;
      return buildTenantUrl({
        slug: rows[0].slug,
        rootDomain,
        secure: process.env.NODE_ENV === "production",
        path: `inscription/google?token=${encodeURIComponent(token)}`,
      });
    } catch {
      return null;
    }
  },
  errorPage: "/auth-central/error",
});
