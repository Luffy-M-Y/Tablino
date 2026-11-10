import { NextRequest, NextResponse } from "next/server";
import { consumeOauthTransferCode, createStudentSession, db, schema, eq } from "@tablino/db";
import { getSessionCookieConfig } from "@tablino/auth";
import { getCurrentUniversityIdOrNull } from "@/lib/university";
import { getReturnCode, resolveReturnDecision } from "@/lib/auth-central-return.mjs";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
};

function cleanRedirect(request: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, request.url), {
    headers: NO_STORE_HEADERS,
  });
}

export async function GET(request: NextRequest) {
  const code = getReturnCode(request.nextUrl.searchParams);

  let universityId: string | null = null;
  try {
    universityId = await getCurrentUniversityIdOrNull();
  } catch {
    // universityId reste null → décision générique
  }

  let consumeResult: { userId: string } | null = null;
  if (code !== null && universityId !== null) {
    try {
      consumeResult = await consumeOauthTransferCode({ code, universityId });
    } catch {
      // consumeResult reste null → décision générique
    }
  }

  const decision = resolveReturnDecision({ code, universityId, consumeResult });
  if (decision.action === "redirect") {
    return cleanRedirect(request, decision.path);
  }

  // Refuse un utilisateur révoqué avant de créer la session.
  try {
    const rows = await db
      .select({ revokedAt: schema.users.revokedAt })
      .from(schema.users)
      .where(eq(schema.users.id, decision.userId))
      .limit(1);
    if (!(rows.length > 0) || rows[0].revokedAt !== null) {
      return cleanRedirect(request, "/connexion");
    }
  } catch {
    return cleanRedirect(request, "/connexion");
  }

  // Crée une nouvelle session tenant avec le même nom et attributs de cookie.
  let session;
  try {
    session = await createStudentSession(decision.userId);
  } catch {
    return cleanRedirect(request, "/connexion");
  }

  const config = getSessionCookieConfig("web");
  const response = NextResponse.redirect(new URL("/", request.url), {
    headers: NO_STORE_HEADERS,
  });
  response.cookies.set(config.name, session.sessionToken, {
    ...config.options,
    expires: session.expires,
  });
  return response;
}
