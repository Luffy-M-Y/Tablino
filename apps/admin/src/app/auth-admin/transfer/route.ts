import { getServerSession } from "next-auth/next";
import { NextRequest, NextResponse } from "next/server";
import { db, deleteStudentSession, eq, schema, createOauthTransferCode } from "@tablino/db";
import { getSessionCookieConfig } from "@tablino/auth";
import { getAdminAuthOptions } from "@/lib/auth";
import { AUTH_ADMIN_TRANSACTION_COOKIE_NAME } from "@/lib/auth-admin-transaction.mjs";
import {
  getAuthAdminTransferCookieExpirations,
  runAuthAdminTransfer,
} from "@/lib/auth-admin-transfer.mjs";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
};

function redirectTo(request: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, request.url), {
    status: 303,
    headers: NO_STORE_HEADERS,
  });
}

export async function GET(request: NextRequest) {
  const sessionCookieConfig = getSessionCookieConfig("admin");
  const secure = process.env.NODE_ENV === "production"
    && sessionCookieConfig.options.secure;

  let outcome: Awaited<ReturnType<typeof runAuthAdminTransfer>> | null = null;
  try {
    const sessionToken = request.cookies.get(sessionCookieConfig.name)?.value;
    const session = await getServerSession(
      getAdminAuthOptions(request.headers.get("host")),
    );
    outcome = await runAuthAdminTransfer({
      host: request.headers.get("host"),
      centralHost: process.env.AUTH_ADMIN_CENTRAL_HOST,
      session,
      sessionToken,
      transactionCookie: request.cookies.get(AUTH_ADMIN_TRANSACTION_COOKIE_NAME)?.value,
      secret: process.env.NEXTAUTH_SECRET,
      now: new Date(),
      adminRootDomain: process.env.ADMIN_ROOT_DOMAIN,
      secure,
      lookupUniversitySlug: async (universityId) => {
        const rows = await db
          .select({ slug: schema.universities.slug })
          .from(schema.universities)
          .where(eq(schema.universities.id, universityId))
          .limit(1);
        return rows.length > 0 ? rows[0].slug : null;
      },
      createTransferCode: createOauthTransferCode,
      deleteSession: deleteStudentSession,
    });
  } catch {
    outcome = null;
  }

  if (!outcome?.ok) return redirectTo(request, "/auth-admin/error");

  try {
    const response = NextResponse.redirect(new URL(outcome.redirectUrl), {
      status: 303,
      headers: NO_STORE_HEADERS,
    });
    for (const cookie of getAuthAdminTransferCookieExpirations(sessionCookieConfig, secure)) {
      response.cookies.set(cookie.name, "", cookie.options);
    }
    return response;
  } catch {
    return redirectTo(request, "/auth-admin/error");
  }
}
