import { NextRequest, NextResponse } from "next/server";
import {
  consumeOauthTransferCode,
  consumeAdminInvitationOauthTransferCode,
  consumeAdminSuperLoginOauthTransferCode,
  createStudentSession,
  db,
  eq,
  schema,
} from "@tablino/db";
import { getSessionCookieConfig } from "@tablino/auth";
import { getAdminHostContext } from "@/lib/admin-host-context";
import { buildAdminRequestUrl } from "@/lib/admin-host.mjs";
import {
  AUTH_ADMIN_RETURN_ERROR_PATH,
  getAuthAdminReturnCode,
  resolveAuthAdminReturnDecision,
} from "@/lib/auth-admin-return.mjs";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
};

function cleanRedirect(
  request: NextRequest,
  path: string,
  expectedKind: "university" | "super" = "university",
) {
  let url = buildAdminRequestUrl({
    host: request.headers.get("host"),
    pathname: path,
    adminRootDomain: process.env.ADMIN_ROOT_DOMAIN,
    slugMapJson: process.env.ADMIN_HOST_SLUG_MAP,
    authAdminCentralHost: process.env.AUTH_ADMIN_CENTRAL_HOST,
    secure: process.env.NODE_ENV === "production",
    expectedKind,
  });
  if (url === null && expectedKind !== "super") {
    url = buildAdminRequestUrl({
      host: request.headers.get("host"),
      pathname: path,
      adminRootDomain: process.env.ADMIN_ROOT_DOMAIN,
      slugMapJson: process.env.ADMIN_HOST_SLUG_MAP,
      authAdminCentralHost: process.env.AUTH_ADMIN_CENTRAL_HOST,
      secure: process.env.NODE_ENV === "production",
      expectedKind: "super",
    });
  }
  if (url === null) return new NextResponse(null, { status: 404, headers: NO_STORE_HEADERS });

  return NextResponse.redirect(new URL(url), {
    status: 303,
    headers: NO_STORE_HEADERS,
  });
}

export async function GET(request: NextRequest) {
  const code = getAuthAdminReturnCode(request.nextUrl.searchParams);
  const flowParam = request.nextUrl.searchParams.get("flow");

  let hostContext: Awaited<ReturnType<typeof getAdminHostContext>> = null;
  try {
    hostContext = await getAdminHostContext();
  } catch {
    return cleanRedirect(request, AUTH_ADMIN_RETURN_ERROR_PATH);
  }

  if (hostContext === null || code === null) {
    return cleanRedirect(request, AUTH_ADMIN_RETURN_ERROR_PATH);
  }

  const expectedKind = hostContext.kind;

  let consumeResult: { userId: string } | null = null;
  if (hostContext.kind === "university") {
    const flow = flowParam ?? "university";
    if (flow !== "university") {
      return cleanRedirect(request, AUTH_ADMIN_RETURN_ERROR_PATH, expectedKind);
    }
    try {
      consumeResult = await consumeOauthTransferCode({
        code,
        universityId: hostContext.universityId,
      });
    } catch {
      return cleanRedirect(request, AUTH_ADMIN_RETURN_ERROR_PATH, expectedKind);
    }
  } else if (hostContext.kind === "super") {
    if (flowParam !== "invitation" && flowParam !== "super_login") {
      return cleanRedirect(request, AUTH_ADMIN_RETURN_ERROR_PATH, expectedKind);
    }
    try {
      if (flowParam === "invitation") {
        consumeResult = await consumeAdminInvitationOauthTransferCode(code);
      } else {
        consumeResult = await consumeAdminSuperLoginOauthTransferCode(code);
      }
    } catch {
      return cleanRedirect(request, AUTH_ADMIN_RETURN_ERROR_PATH, expectedKind);
    }
  } else {
    return cleanRedirect(request, AUTH_ADMIN_RETURN_ERROR_PATH);
  }

  if (consumeResult === null) {
    return cleanRedirect(request, AUTH_ADMIN_RETURN_ERROR_PATH, expectedKind);
  }

  let user: {
    id: string;
    role: string;
    universityId: string | null;
    revokedAt: Date | null;
  } | null = null;
  try {
    const rows = await db
      .select({
        id: schema.users.id,
        role: schema.users.role,
        universityId: schema.users.universityId,
        revokedAt: schema.users.revokedAt,
      })
      .from(schema.users)
      .where(eq(schema.users.id, consumeResult.userId))
      .limit(1);
    if (rows.length > 0) user = rows[0];
  } catch {
    return cleanRedirect(request, AUTH_ADMIN_RETURN_ERROR_PATH, expectedKind);
  }

  const decision = resolveAuthAdminReturnDecision({
    code,
    flow: flowParam ?? (hostContext.kind === "university" ? "university" : null),
    hostContext,
    consumeResult,
    user,
  });
  if (decision.action === "redirect") {
    return cleanRedirect(request, decision.path, expectedKind);
  }

  let session: Awaited<ReturnType<typeof createStudentSession>>;
  try {
    session = await createStudentSession(decision.userId);
  } catch {
    return cleanRedirect(request, AUTH_ADMIN_RETURN_ERROR_PATH, expectedKind);
  }

  try {
    const redirectUrl = buildAdminRequestUrl({
      host: request.headers.get("host"),
      pathname: "/",
      adminRootDomain: process.env.ADMIN_ROOT_DOMAIN,
      slugMapJson: process.env.ADMIN_HOST_SLUG_MAP,
      authAdminCentralHost: process.env.AUTH_ADMIN_CENTRAL_HOST,
      secure: process.env.NODE_ENV === "production",
      expectedKind,
    });
    if (redirectUrl === null) {
      return new NextResponse(null, { status: 404, headers: NO_STORE_HEADERS });
    }
    const cookieConfig = getSessionCookieConfig("admin");
    const response = NextResponse.redirect(new URL(redirectUrl), {
      status: 303,
      headers: NO_STORE_HEADERS,
    });
    response.cookies.set(cookieConfig.name, session.sessionToken, {
      ...cookieConfig.options,
      expires: session.expires,
    });
    return response;
  } catch {
    return cleanRedirect(request, AUTH_ADMIN_RETURN_ERROR_PATH, expectedKind);
  }
}
