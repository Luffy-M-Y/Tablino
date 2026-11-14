import { NextRequest, NextResponse } from "next/server";
import {
  consumeOauthTransferCode,
  createStudentSession,
  db,
  eq,
  schema,
} from "@tablino/db";
import { getSessionCookieConfig } from "@tablino/auth";
import { getAdminHostContext } from "@/lib/admin-host-context";
import {
  AUTH_ADMIN_RETURN_ERROR_PATH,
  getAuthAdminReturnCode,
  resolveAuthAdminReturnDecision,
} from "@/lib/auth-admin-return.mjs";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
};

function cleanRedirect(request: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, request.url), {
    status: 303,
    headers: NO_STORE_HEADERS,
  });
}

export async function GET(request: NextRequest) {
  const code = getAuthAdminReturnCode(request.nextUrl.searchParams);

  let hostContext: Awaited<ReturnType<typeof getAdminHostContext>> = null;
  try {
    hostContext = await getAdminHostContext();
  } catch {
    return cleanRedirect(request, AUTH_ADMIN_RETURN_ERROR_PATH);
  }
  if (hostContext?.kind !== "university" || code === null) {
    return cleanRedirect(request, AUTH_ADMIN_RETURN_ERROR_PATH);
  }

  let consumeResult: { userId: string } | null = null;
  try {
    consumeResult = await consumeOauthTransferCode({
      code,
      universityId: hostContext.universityId,
    });
  } catch {
    return cleanRedirect(request, AUTH_ADMIN_RETURN_ERROR_PATH);
  }
  if (consumeResult === null) {
    return cleanRedirect(request, AUTH_ADMIN_RETURN_ERROR_PATH);
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
    return cleanRedirect(request, AUTH_ADMIN_RETURN_ERROR_PATH);
  }

  const decision = resolveAuthAdminReturnDecision({
    code,
    hostContext,
    consumeResult,
    user,
  });
  if (decision.action === "redirect") {
    return cleanRedirect(request, decision.path);
  }

  let session: Awaited<ReturnType<typeof createStudentSession>>;
  try {
    session = await createStudentSession(decision.userId);
  } catch {
    return cleanRedirect(request, AUTH_ADMIN_RETURN_ERROR_PATH);
  }

  try {
    const cookieConfig = getSessionCookieConfig("admin");
    const response = NextResponse.redirect(new URL("/", request.url), {
      status: 303,
      headers: NO_STORE_HEADERS,
    });
    response.cookies.set(cookieConfig.name, session.sessionToken, {
      ...cookieConfig.options,
      expires: session.expires,
    });
    return response;
  } catch {
    return cleanRedirect(request, AUTH_ADMIN_RETURN_ERROR_PATH);
  }
}
