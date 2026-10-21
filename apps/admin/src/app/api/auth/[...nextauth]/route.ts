import NextAuth from "next-auth";
import { createAuthOptions, getCurrentUniversityId } from "@tablino/auth";

const handler = NextAuth(createAuthOptions({
  surface: "admin",
  getCurrentUniversityId,
}));

export { handler as GET, handler as POST };
