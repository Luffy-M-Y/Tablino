import { NextResponse, type NextRequest } from "next/server";
import {
  AUTH_CENTRAL_ROUTE_HEADER,
  shouldBypassTenantResolution,
} from "./lib/auth-central-host.mjs";
import {
  isRootSiteHost,
  ROOT_SITE_PATH,
  ROOT_SITE_ROUTE_HEADER,
} from "./lib/root-site.mjs";

export function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete(AUTH_CENTRAL_ROUTE_HEADER);
  requestHeaders.delete(ROOT_SITE_ROUTE_HEADER);

  if (
    shouldBypassTenantResolution(
      request.headers.get("host"),
      request.nextUrl.pathname,
      process.env.AUTH_CENTRAL_HOST,
    )
  ) {
    requestHeaders.set(AUTH_CENTRAL_ROUTE_HEADER, "1");
  } else if (isRootSiteHost(request.headers.get("host"), process.env.ROOT_DOMAIN)) {
    // Domaine racine : seule la vitrine est servie ; les autres chemins restent « Adresse inconnue ».
    const pathname = request.nextUrl.pathname;
    if (pathname === "/" || pathname === ROOT_SITE_PATH) {
      requestHeaders.set(ROOT_SITE_ROUTE_HEADER, "1");
      const rewriteUrl = request.nextUrl.clone();
      rewriteUrl.pathname = ROOT_SITE_PATH;
      return NextResponse.rewrite(rewriteUrl, { request: { headers: requestHeaders } });
    }
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
