import { cookies, headers } from "next/headers";
import { createAuthOptions } from "@tablino/auth";
import { AUTH_TRANSACTION_COOKIE_NAME } from "./auth-central-start.mjs";
import { createGoogleUniversityResolver } from "./google-university-resolver.mjs";
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
});
