export type AuthSurface = "web" | "admin";
export type GuardRole = "super_admin" | "university_admin" | "student";

export type GuardUser = {
  id: string;
  role: GuardRole;
  universityId: string | null;
  universityName?: string | null;
  universityAcronym?: string | null;
  universityStatus: "pending" | "approved" | "active" | null;
  revokedAt: Date | null;
  trialEndsAt: Date | null;
  subscriptionExpiresAt: Date | null;
  currentPlan: string | null;
};

type GuardSession = { user?: { id?: string | null } | null } | null;

export class SessionRequiredError extends Error {
  constructor() {
    super("Une session active est requise.");
    this.name = "SessionRequiredError";
  }
}

export class AuthorizationDeniedError extends Error {
  constructor() {
    super("Accès refusé.");
    this.name = "AuthorizationDeniedError";
  }
}

type GuardDependencies = {
  readSession: (surface: AuthSurface) => Promise<GuardSession>;
  readUser: (userId: string) => Promise<GuardUser | null>;
};

const surfaceRoles: Record<AuthSurface, readonly GuardRole[]> = {
  web: ["student"],
  admin: ["super_admin", "university_admin"],
};

export function createAuthGuards(dependencies: GuardDependencies) {
  async function requireSession(surface: AuthSurface): Promise<GuardUser> {
    const session = await dependencies.readSession(surface);
    const userId = session?.user?.id;
    if (!userId) throw new SessionRequiredError();

    // Role and university scope always come from the current database row.
    const user = await dependencies.readUser(userId);
    if (!user) throw new SessionRequiredError();
    if (user.revokedAt !== null) throw new AuthorizationDeniedError();
    return user;
  }

  async function requireRole(
    surface: AuthSurface,
    allowedRoles: readonly GuardRole[],
  ): Promise<GuardUser> {
    const user = await requireSession(surface);
    if (
      !surfaceRoles[surface].includes(user.role)
      || !allowedRoles.includes(user.role)
      || (
        user.role === "university_admin"
        && (user.universityStatus === "pending" || user.universityStatus === "approved")
      )
    ) {
      throw new AuthorizationDeniedError();
    }
    return user;
  }

  async function requireUniversityAccess(
    surface: AuthSurface,
    universityId: string,
  ): Promise<GuardUser> {
    const user = await requireSession(surface);
    if (
      user.role === "university_admin"
      && (user.universityStatus === "pending" || user.universityStatus === "approved")
    ) {
      throw new AuthorizationDeniedError();
    }
    if (user.role === "super_admin") return user;

    if (user.role === "university_admin" && user.universityId === universityId) return user;
    if (surface === "web" && user.role === "student" && user.universityId === universityId) return user;
    throw new AuthorizationDeniedError();
  }

  return { requireSession, requireRole, requireUniversityAccess };
}
