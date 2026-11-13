import { NextResponse, type NextRequest } from "next/server";
import { resolveAdminHost } from "./lib/admin-host.mjs";

export function proxy(request: NextRequest) {
  const host = request.headers.get("host");
  const adminRootDomain = process.env.ADMIN_ROOT_DOMAIN;
  if (!adminRootDomain) {
    if (process.env.NODE_ENV === "production") {
      return new NextResponse(null, { status: 404 });
    }
    return NextResponse.next();
  }

  const resolution = resolveAdminHost(host, adminRootDomain, process.env.ADMIN_HOST_SLUG_MAP);
  if (resolution === null) {
    return new NextResponse(null, { status: 404 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth).*)"],
};
