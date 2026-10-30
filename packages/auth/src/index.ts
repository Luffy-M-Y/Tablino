import { and, eq, sql } from "drizzle-orm";
import type {
  Adapter,
  AdapterAccount,
  AdapterSession,
  AdapterUser,
  VerificationToken,
} from "next-auth/adapters";
import GoogleProvider from "next-auth/providers/google";
import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth/next";
import { db, googleEmailMatchesUser, markGoogleEmailVerified, schema } from "@tablino/db";
import type {} from "./next-auth";
import { createGoogleSignupToken } from "./google-signup-token";
import type { AuthRole } from "./roles";
import { createAuthGuards, type AuthSurface, type GuardRole } from "./guards";

const googleEmailsByAccount = new Map<string, { email: string; at: number }>();

export type { AuthRole } from "./roles";

type StoredUser = typeof schema.users.$inferSelect;
type AuthAdapterUser = AdapterUser & Pick<StoredUser, "role" | "universityId">;
export type { AuthSurface } from "./guards";
export {
  AuthorizationDeniedError,
  SessionRequiredError,
  type GuardRole,
  type GuardUser,
} from "./guards";

type AuthOptionsContext = {
  surface: AuthSurface;
  getCurrentUniversityId: () => Promise<string>;
};

function toAuthUser(user: StoredUser): AuthAdapterUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified,
    image: user.image,
    role: user.role,
    universityId: user.universityId,
  };
}

async function getUserById(id: string): Promise<AuthAdapterUser | null> {
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
  return user ? toAuthUser(user) : null;
}

async function getUserByEmail(email: string): Promise<AuthAdapterUser | null> {
  const [user] = await db.select().from(schema.users)
    .where(sql`lower(${schema.users.email}) = lower(${email})`)
    .limit(1);
  return user ? toAuthUser(user) : null;
}

async function getUserByAccount(
  provider: string,
  providerAccountId: string,
): Promise<AuthAdapterUser | null> {
  const [row] = await db.select({ user: schema.users })
    .from(schema.users)
    .innerJoin(schema.accounts, eq(schema.accounts.userId, schema.users.id))
    .where(and(
      eq(schema.accounts.provider, provider),
      eq(schema.accounts.providerAccountId, providerAccountId),
    ))
    .limit(1);
  return row ? toAuthUser(row.user) : null;
}

function toAdapterAccount(account: typeof schema.accounts.$inferSelect): AdapterAccount {
  return {
    userId: account.userId,
    type: account.type as AdapterAccount["type"],
    provider: account.provider,
    providerAccountId: account.providerAccountId,
    refresh_token: account.refreshToken ?? undefined,
    access_token: account.accessToken ?? undefined,
    expires_at: account.expiresAt ?? undefined,
    token_type: account.tokenType ?? undefined,
    scope: account.scope ?? undefined,
    id_token: account.idToken ?? undefined,
    session_state: account.sessionState ?? undefined,
  };
}

function createDrizzleAdapter(context: AuthOptionsContext): Adapter {
  return {
    async createUser(user: Omit<AdapterUser, "id">) {
      throw new Error("La création de compte par Google exige un code d'accès.");
    },

    async getUser(id) {
      return getUserById(id);
    },

    async getUserByEmail(email) {
      return getUserByEmail(email);
    },

    async getUserByAccount({ provider, providerAccountId }) {
      return getUserByAccount(provider, providerAccountId);
    },

    async updateUser(user) {
      const changes: Partial<typeof schema.users.$inferInsert> = {};
      if (user.name !== undefined) changes.name = user.name;
      if (user.email !== undefined) changes.email = user.email;
      if (user.emailVerified !== undefined) changes.emailVerified = user.emailVerified;
      if (user.image !== undefined) changes.image = user.image;

      if (Object.keys(changes).length === 0) {
        const stored = await getUserById(user.id);
        if (!stored) throw new Error("Utilisateur introuvable.");
        return stored;
      }

      const [updated] = await db.update(schema.users)
        .set(changes)
        .where(eq(schema.users.id, user.id))
        .returning();
      if (!updated) throw new Error("Utilisateur introuvable.");
      return toAuthUser(updated);
    },

    async linkAccount(account: AdapterAccount) {
      const googleEmail = googleEmailsByAccount.get(account.providerAccountId);
      googleEmailsByAccount.delete(account.providerAccountId);
      const user = await getUserById(account.userId);
      if (
        !googleEmail
        || Date.now() - googleEmail.at > 60000
        || !user
        || !googleEmailMatchesUser(user.email, googleEmail.email)
      ) {
        throw new Error("Liaison Google refusee.");
      }

      const [linked] = await db.insert(schema.accounts).values({
        userId: account.userId,
        type: account.type,
        provider: account.provider,
        providerAccountId: account.providerAccountId,
        refreshToken: null,
        accessToken: null,
        expiresAt: account.expires_at ?? null,
        tokenType: account.token_type ?? null,
        scope: account.scope ?? null,
        idToken: null,
        sessionState: account.session_state ?? null,
      }).onConflictDoNothing({
        target: [schema.accounts.provider, schema.accounts.providerAccountId],
      }).returning();
      if (linked) await markGoogleEmailVerified(account.userId, new Date());
      return linked ? account : null;
    },

    async unlinkAccount({ provider, providerAccountId }: Pick<AdapterAccount, "provider" | "providerAccountId">) {
      const [unlinked] = await db.delete(schema.accounts)
        .where(and(
          eq(schema.accounts.provider, provider),
          eq(schema.accounts.providerAccountId, providerAccountId),
        ))
        .returning();
      return unlinked ? toAdapterAccount(unlinked) : undefined;
    },

    async createSession(session) {
      const [created] = await db.insert(schema.sessions).values(session).returning();
      if (!created) throw new Error("Échec de création de la session.");
      return {
        sessionToken: created.sessionToken,
        userId: created.userId,
        expires: created.expires,
      } satisfies AdapterSession;
    },

    async getSessionAndUser(sessionToken) {
      const [row] = await db.select({ session: schema.sessions, user: schema.users })
        .from(schema.sessions)
        .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
        .where(eq(schema.sessions.sessionToken, sessionToken))
        .limit(1);
      if (!row) return null;
      return {
        session: {
          sessionToken: row.session.sessionToken,
          userId: row.session.userId,
          expires: row.session.expires,
        },
        user: toAuthUser(row.user),
      };
    },

    async updateSession(session) {
      const changes: Partial<typeof schema.sessions.$inferInsert> = {};
      if (session.userId !== undefined) changes.userId = session.userId;
      if (session.expires !== undefined) changes.expires = session.expires;

      if (Object.keys(changes).length === 0) {
        const [stored] = await db.select().from(schema.sessions)
          .where(eq(schema.sessions.sessionToken, session.sessionToken))
          .limit(1);
        return stored ? {
          sessionToken: stored.sessionToken,
          userId: stored.userId,
          expires: stored.expires,
        } : null;
      }

      const [updated] = await db.update(schema.sessions)
        .set(changes)
        .where(eq(schema.sessions.sessionToken, session.sessionToken))
        .returning();
      return updated ? {
        sessionToken: updated.sessionToken,
        userId: updated.userId,
        expires: updated.expires,
      } : null;
    },

    async deleteSession(sessionToken) {
      const [deleted] = await db.delete(schema.sessions)
        .where(eq(schema.sessions.sessionToken, sessionToken))
        .returning();
      return deleted ? {
        sessionToken: deleted.sessionToken,
        userId: deleted.userId,
        expires: deleted.expires,
      } : undefined;
    },

    async createVerificationToken(token) {
      const [created] = await db.insert(schema.verificationTokens)
        .values(token)
        .onConflictDoNothing({
          target: [schema.verificationTokens.identifier, schema.verificationTokens.token],
        })
        .returning();
      return created ? {
        identifier: created.identifier,
        token: created.token,
        expires: created.expires,
      } : null;
    },

    async useVerificationToken({ identifier, token }) {
      const [used] = await db.delete(schema.verificationTokens)
        .where(and(
          eq(schema.verificationTokens.identifier, identifier),
          eq(schema.verificationTokens.token, token),
        ))
        .returning();
      return used ? {
        identifier: used.identifier,
        token: used.token,
        expires: used.expires,
      } : null;
    },
  };
}

export async function getCurrentUniversityId(): Promise<string> {
  const universityId = process.env.UNIVERSITY_ID;
  if (!universityId) throw new Error("UNIVERSITY_ID manquant dans les variables serveur.");
  return universityId;
}

function safeAuthLogCode(code: string): string {
  return /^[A-Z0-9_]+$/.test(code) ? code : "UNKNOWN";
}

function safeAuthErrorDetails(metadata: unknown) {
  const sourceError = metadata instanceof Error
    ? metadata
    : typeof metadata === "object" && metadata !== null && "error" in metadata
      ? metadata.error
      : undefined;

  if (typeof sourceError !== "object" || sourceError === null) return {};

  const error = sourceError as { name?: unknown; code?: unknown; message?: unknown };
  const name = typeof error.name === "string"
    ? error.name.replace(/[\r\n\t]/g, " ").slice(0, 80)
    : undefined;
  const errorCode = typeof error.code === "string"
    && error.code.length <= 40
    && /^[A-Za-z0-9_.-]+$/.test(error.code)
    ? error.code
    : undefined;
  const message = typeof error.message === "string"
    ? error.message
      .replace(/https?:\/\/\S+/g, "[url]")
      .replace(/\b[\w.+-]+@[\w.-]+\.[A-Z]{2,}\b/gi, "[email]")
      .replace(/\b(?:access_token|refresh_token|id_token|token|secret|password|cookie|authorization)\s*[:=]\s*["']?[^"'\s,;]+/gi, "[redacted]")
      .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[token]")
      .replace(/\b[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\b/gi, "[id]")
      .replace(/[\r\n\t]/g, " ")
      .slice(0, 120)
    : undefined;

  return { name, code: errorCode, message };
}

export function getSessionCookieConfig(surface: AuthSurface) {
  const secureCookies = process.env.NEXTAUTH_URL?.startsWith("https://") ?? false;
  return {
    name: (secureCookies ? "__Secure-" : "") + "tablino-" + surface + ".session-token",
    options: {
      httpOnly: true,
      sameSite: "lax" as const,
      path: "/",
      secure: secureCookies,
    },
  };
}

export function createAuthOptions(context: AuthOptionsContext): NextAuthOptions {
  return {
    adapter: createDrizzleAdapter(context),
    providers: [GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
      httpOptions: { timeout: 10_000 },
    })],
    debug: false,
    logger: {
      error(code, metadata) {
        console.error(JSON.stringify({
          code: safeAuthLogCode(code),
          ...safeAuthErrorDetails(metadata),
        }));
      },
      warn(code) {
        console.warn(JSON.stringify({ code: safeAuthLogCode(code) }));
      },
      debug() {},
    },
    session: { strategy: "database" },
    cookies: {
      sessionToken: getSessionCookieConfig(context.surface),
    },
    callbacks: {
      async signIn({ user, account, profile }) {
        if (account?.provider !== "google") return false;
        const googleProfile = profile as { email?: string; email_verified?: boolean } | undefined;
        const email = googleProfile?.email ?? user.email;
        if (!email || googleProfile?.email_verified !== true) return false;

        const now = Date.now();
        for (const [providerAccountId, entry] of googleEmailsByAccount) {
          if (now - entry.at > 60000) googleEmailsByAccount.delete(providerAccountId);
        }
        googleEmailsByAccount.set(account.providerAccountId, { email: email, at: now });

        const linkedUser = await getUserByAccount(account.provider, account.providerAccountId);
        const emailUser = linkedUser ? null : await getUserByEmail(email);
        if (emailUser) {
          const [existingAccount] = await db.select({ userId: schema.accounts.userId })
            .from(schema.accounts)
            .where(eq(schema.accounts.userId, emailUser.id))
            .limit(1);
          if (existingAccount) return false;
        }
        const storedUser = linkedUser ?? emailUser;

        if (!storedUser) {
          if (context.surface !== "web") return false;
          await context.getCurrentUniversityId();
          googleEmailsByAccount.delete(account.providerAccountId);
          return "/inscription/google?token=" + encodeURIComponent(createGoogleSignupToken({
            email: email,
            name: user.name ?? null,
            image: user.image ?? null,
            providerAccountId: account.providerAccountId,
          }));
        }

        if (context.surface === "web") {
          return storedUser.role === "student"
            && storedUser.universityId === await context.getCurrentUniversityId();
        }

        if (storedUser.role === "super_admin") return storedUser.universityId === null;
        return storedUser.role === "university_admin"
          && storedUser.universityId !== null;
      },

      async session({ session, user }) {
        const storedUser = user as AuthAdapterUser;
        if (session.user) {
          session.user.id = storedUser.id;
          session.user.role = storedUser.role as AuthRole;
          session.user.universityId = storedUser.universityId;
        }
        return session;
      },
    },
  };
}

const guards = createAuthGuards({
  async readSession(surface) {
    const session = await getServerSession(createAuthOptions({
      surface,
      getCurrentUniversityId,
    }));
    return session?.user?.id ? { user: { id: session.user.id } } : null;
  },
  async readUser(userId) {
    const [user] = await db.select({
      id: schema.users.id,
      role: schema.users.role,
      universityId: schema.users.universityId,
      revokedAt: schema.users.revokedAt,
      trialEndsAt: schema.users.trialEndsAt,
      subscriptionExpiresAt: schema.users.subscriptionExpiresAt,
      currentPlan: schema.users.currentPlan,
    }).from(schema.users).where(eq(schema.users.id, userId)).limit(1);
    return user ?? null;
  },
});

export async function requireSession(surface: AuthSurface) {
  return guards.requireSession(surface);
}

export async function requireRole(
  surface: AuthSurface,
  allowedRoles: readonly GuardRole[],
) {
  return guards.requireRole(surface, allowedRoles);
}

export async function requireUniversityAccess(surface: AuthSurface, universityId: string) {
  return guards.requireUniversityAccess(surface, universityId);
}

export {
  createGoogleSignupToken,
  verifyGoogleSignupToken,
  GOOGLE_SIGNUP_TOKEN_TTL_MS,
} from "./google-signup-token";
export type { GoogleSignupPayload } from "./google-signup-token";
export {
  createEmailVerificationToken,
  verifyEmailVerificationToken,
  getEmailVerificationCookieConfig,
  EMAIL_VERIFICATION_TOKEN_TTL_MS,
} from "./email-verification-token";
