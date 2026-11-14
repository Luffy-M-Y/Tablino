import NextAuth from "next-auth";
import type { NextRequest } from "next/server";
import { getAdminAuthOptions } from "@/lib/auth";

type NextAuthRouteContext = { params: Promise<{ nextauth: string[] }> };

function handler(request: NextRequest, context: NextAuthRouteContext) {
  return NextAuth(request, context, getAdminAuthOptions(request.headers.get("host")));
}

export { handler as GET, handler as POST };
