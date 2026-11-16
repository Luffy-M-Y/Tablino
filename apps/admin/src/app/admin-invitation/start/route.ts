import { getCloudflareClientIp } from "@tablino/auth";
import {
  checkRateLimit,
  checkAdminInvitationToken,
  recordFailure,
} from "@tablino/db";
import { getAdminHostContext } from "@/lib/admin-host-context";
import {
  getAdminInvitationCookieOptions,
  ADMIN_INVITATION_COOKIE,
  ADMIN_INVITATION_PATH,
} from "@/lib/admin-invitation.mjs";
import { NextRequest, NextResponse } from "next/server";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
};

function redirectToAcceptance(
  secure: boolean,
  token?: string,
  clearInvitationCookie = false,
) {
  const response = new NextResponse(null, {
    status: 303,
    headers: {
      Location: ADMIN_INVITATION_PATH,
      ...NO_STORE_HEADERS,
    },
  });
  if (token) {
    response.cookies.set(
      ADMIN_INVITATION_COOKIE,
      token,
      getAdminInvitationCookieOptions(secure),
    );
  } else if (clearInvitationCookie) {
    response.cookies.set(
      ADMIN_INVITATION_COOKIE,
      "",
      {
        ...getAdminInvitationCookieOptions(secure),
        maxAge: 0,
      },
    );
  }
  return response;
}

export async function GET(request: NextRequest) {
  const hostContext = await getAdminHostContext();
  if (hostContext?.kind !== "super") {
    return new NextResponse(null, { status: 404, headers: NO_STORE_HEADERS });
  }

  const secure = process.env.NODE_ENV === "production";
  const clientIp = getCloudflareClientIp(request.headers);
  if (clientIp === null && secure) {
    return redirectToAcceptance(secure);
  }

  if (clientIp !== null) {
    const ipLimit = await checkRateLimit("login_ip", clientIp);
    if (!ipLimit.allowed) return redirectToAcceptance(secure);
  }

  const token = request.nextUrl.searchParams.get("token");
  if (token === null || token.length === 0) {
    return redirectToAcceptance(secure);
  }

  const role = await checkAdminInvitationToken(token);
  if (role === null) {
    if (clientIp !== null) {
      await recordFailure("login_ip", clientIp);
    }
    return redirectToAcceptance(secure, undefined, true);
  }

  return redirectToAcceptance(secure, token);
}
