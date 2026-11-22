import {
  getPasswordResetConfirmedCookieConfig,
  getPasswordResetCookieConfig,
} from "@tablino/auth";
import { cookies } from "next/headers";

export async function GET() {
  const requestConfig = getPasswordResetCookieConfig();
  const confirmedConfig = getPasswordResetConfirmedCookieConfig();
  const cookieStore = await cookies();
  cookieStore.set(requestConfig.name, "", { ...requestConfig.options, maxAge: 0 });
  cookieStore.set(confirmedConfig.name, "", { ...confirmedConfig.options, maxAge: 0 });

  return new Response(null, {
    status: 303,
    headers: {
      Location: "/connexion?reset=ok",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}
