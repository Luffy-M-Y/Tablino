import { deleteStudentSession } from "@tablino/db";
import { getSessionCookieConfig } from "@tablino/auth";
import { NextResponse, type NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin !== null) {
    const host = request.headers.get("host");
    let originHost: string;
    try {
      originHost = new URL(origin).host;
    } catch {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (host === null || originHost.toLowerCase() !== host.toLowerCase()) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      );
    }
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
