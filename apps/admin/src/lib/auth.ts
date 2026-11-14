import { cookies, headers } from "next/headers";
import { createAuthOptions, getCurrentUniversityId } from "@tablino/auth";
import { AUTH_ADMIN_TRANSACTION_COOKIE_NAME } from "./auth-admin-transaction.mjs";
import { createAdminGoogleUniversityResolver } from "./admin-google-resolver.mjs";
import { isAuthAdminCentralHost } from "./admin-host.mjs";

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
    isAuthAdminCentral: isAuthAdminCentralHost(host, process.env.AUTH_ADMIN_CENTRAL_HOST),
  });
}
