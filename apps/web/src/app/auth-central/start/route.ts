import { consumeOauthStartTicket } from "@tablino/db";
import { getSessionCookieConfig } from "@tablino/auth";
import { createAuthCentralStartHandler } from "@/lib/auth-central-start.mjs";

const handleStart = createAuthCentralStartHandler({
  consumeOauthStartTicket: (ticket) => consumeOauthStartTicket(ticket, "web"),
  getSecret: () => process.env.NEXTAUTH_SECRET,
  secure: process.env.NODE_ENV === "production"
    && getSessionCookieConfig("web").options.secure,
  baseUrl: process.env.NEXTAUTH_URL,
  authCentralHost: process.env.AUTH_CENTRAL_HOST,
});

export function POST(request: Request) {
  return handleStart(request);
}
