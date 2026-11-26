import { deleteStudentSession } from "@tablino/db";
import { getSessionCookieConfig } from "@tablino/auth";
import { NextResponse, type NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  // Origin obligatoire : sans lui, impossible de prouver que la demande vient du site.
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  let originHost: string | null = null;
  try {
    originHost = origin === null ? null : new URL(origin).host;
  } catch {
    originHost = null;
  }
  if (originHost === null || host === null || originHost.toLowerCase() !== host.toLowerCase()) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  const config = getSessionCookieConfig("web");
  const token = request.cookies.get(config.name)?.value;
  if (token !== undefined && token !== "") {
    try {
      await deleteStudentSession(token);
    } catch {
      // Le cookie est effacé dans tous les cas.
    }
  }

  const response = NextResponse.json(
    { redirectTo: "/connexion" },
    { headers: { "Cache-Control": "no-store" } },
  );
  response.cookies.set(config.name, "", { ...config.options, maxAge: 0 });
  return response;
}
