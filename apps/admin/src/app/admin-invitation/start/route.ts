import { getCloudflareClientIp } from "@tablino/auth";
import {
  checkRateLimit,
  checkSuperAdminEditorInvitationToken,
  recordFailure,
} from "@tablino/db";
import { getAdminHostContext } from "@/lib/admin-host-context";
import {
  getSuperAdminEditorInvitationCookieOptions,
  SUPER_ADMIN_EDITOR_INVITATION_COOKIE,
} from "@/lib/super-admin-editor-invitation.mjs";
import { NextRequest, NextResponse } from "next/server";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
};

function redirectToAcceptance(request: NextRequest, secure: boolean, token?: string) {
  const response = NextResponse.redirect(
    new URL("/admin-invitation/accept", request.url),
    { status: 303, headers: NO_STORE_HEADERS },
  );
  if (token) {
    response.cookies.set(
      SUPER_ADMIN_EDITOR_INVITATION_COOKIE,
      token,
      getSuperAdminEditorInvitationCookieOptions(secure),
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
    return redirectToAcceptance(request, secure);
  }

  if (clientIp !== null) {
    const ipLimit = await checkRateLimit("login_ip", clientIp);
    if (!ipLimit.allowed) return redirectToAcceptance(request, secure);
  }

  const token = request.nextUrl.searchParams.get("token");
  if (token === null || token.length === 0) {
    return redirectToAcceptance(request, secure);
  }

  const available = await checkSuperAdminEditorInvitationToken(token);
  if (!available) {
    if (clientIp !== null) {
      await recordFailure("login_ip", clientIp);
    }
    return redirectToAcceptance(request, secure);
  }

  return redirectToAcceptance(request, secure, token);
}
