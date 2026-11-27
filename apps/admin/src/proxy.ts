import { NextResponse, type NextRequest } from "next/server";
import { getAdminSignupHostRedirect, isAdminProxyPathAllowed, resolveAdminHost } from "./lib/admin-host.mjs";

export function proxy(request: NextRequest) {
  const host = request.headers.get("host");
  const adminRootDomain = process.env.ADMIN_ROOT_DOMAIN;
  const resolution = resolveAdminHost(
    host,
    adminRootDomain ?? "",
    process.env.ADMIN_HOST_SLUG_MAP,
    process.env.AUTH_ADMIN_CENTRAL_HOST,
  );
  if (resolution?.kind === "central") {
    if (!isAdminProxyPathAllowed(resolution.kind, request.nextUrl.pathname)) {
      return new NextResponse(null, { status: 404 });
    }
    return NextResponse.next();
  }

  if (!adminRootDomain) {
    if (process.env.NODE_ENV === "production") {
      return new NextResponse(null, { status: 404 });
    }
    return NextResponse.next();
  }

  if (resolution === null) {
    return new NextResponse(null, { status: 404 });
  }

  const signupRedirect = getAdminSignupHostRedirect({
    kind: resolution.kind,
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
    adminRootDomain,
    secure: process.env.NODE_ENV === "production",
  });
  if (signupRedirect !== null) {
    return new NextResponse(null, {
      status: 308,
      headers: { Location: signupRedirect, "Cache-Control": "no-store" },
    });
  }

  if (!isAdminProxyPathAllowed(resolution.kind, request.nextUrl.pathname)) {
    return new NextResponse(null, { status: 404 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
