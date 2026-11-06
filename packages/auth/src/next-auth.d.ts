import type { DefaultSession } from "next-auth";
import type { AuthRole } from "./roles";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: AuthRole;
      universityId: string | null;
    };
  }
}
