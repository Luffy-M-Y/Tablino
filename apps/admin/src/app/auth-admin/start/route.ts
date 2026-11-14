import { consumeOauthStartTicket } from "@tablino/db";
import { getSessionCookieConfig } from "@tablino/auth";
import { createAuthAdminStartHandler } from "@/lib/auth-admin-start.mjs";

const handleStart = createAuthAdminStartHandler({
  consumeOauthStartTicket: (ticket) => consumeOauthStartTicket(ticket, "admin"),
  getSecret: () => process.env.NEXTAUTH_SECRET,
  secure: process.env.NODE_ENV === "production"
    && getSessionCookieConfig("admin").options.secure,
  baseUrl: process.env.NEXTAUTH_URL,
  authAdminCentralHost: process.env.AUTH_ADMIN_CENTRAL_HOST,
});

export function POST(request: Request) {
  return handleStart(request);
}
