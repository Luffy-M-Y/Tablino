import { NextResponse, type NextRequest } from "next/server";
import {
  AUTH_CENTRAL_ROUTE_HEADER,
  shouldBypassTenantResolution,
} from "./lib/auth-central-host.mjs";

export function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete(AUTH_CENTRAL_ROUTE_HEADER);

  if (
    shouldBypassTenantResolution(
      request.headers.get("host"),
      request.nextUrl.pathname,
      process.env.AUTH_CENTRAL_HOST,
    )
  ) {
    requestHeaders.set(AUTH_CENTRAL_ROUTE_HEADER, "1");
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
