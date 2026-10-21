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
import { db, schema } from "@tablino/db";
import type {} from "./next-auth";
import type { AuthRole } from "./roles";

export type { AuthRole } from "./roles";

type StoredUser = typeof schema.users.$inferSelect;
type AuthAdapterUser = AdapterUser & Pick<StoredUser, "role" | "universityId">;
type AuthSurface = "web" | "admin";

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
      if (context.surface !== "web") {
        throw new Error("La création de compte est désactivée dans l’application admin.");
      }

      const universityId = await context.getCurrentUniversityId();
      const [created] = await db.insert(schema.users).values({
        name: user.name ?? null,
        email: user.email,
        emailVerified: user.emailVerified ?? null,
        image: user.image ?? null,
        role: "student",
        universityId,
      }).returning();
      if (!created) throw new Error("Échec de création du compte étudiant.");
      return toAuthUser(created);
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
      const [linked] = await db.insert(schema.accounts).values({
        userId: account.userId,
        type: account.type,
        provider: account.provider,
        providerAccountId: account.providerAccountId,
        refreshToken: account.refresh_token ?? null,
        accessToken: account.access_token ?? null,
        expiresAt: account.expires_at ?? null,
        tokenType: account.token_type ?? null,
        scope: account.scope ?? null,
        idToken: account.id_token ?? null,
        sessionState: account.session_state ?? null,
      }).onConflictDoNothing({
        target: [schema.accounts.provider, schema.accounts.providerAccountId],
      }).returning();
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

export function createAuthOptions(context: AuthOptionsContext): NextAuthOptions {
  const secureCookies = process.env.NEXTAUTH_URL?.startsWith("https://") ?? false;

  return {
    adapter: createDrizzleAdapter(context),
    providers: [GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    })],
    session: { strategy: "database" },
    cookies: {
      sessionToken: {
        name: `${secureCookies ? "__Secure-" : ""}tablino-${context.surface}.session-token`,
        options: {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          secure: secureCookies,
        },
      },
    },
    callbacks: {
      async signIn({ user, account, profile }) {
        if (account?.provider !== "google") return false;
        const googleProfile = profile as { email?: string; email_verified?: boolean } | undefined;
        const email = googleProfile?.email ?? user.email;
        if (!email || googleProfile?.email_verified !== true) return false;

        const storedUser = await getUserByAccount(account.provider, account.providerAccountId)
          ?? await getUserByEmail(email);

        if (!storedUser) {
          if (context.surface !== "web") return false;
          await context.getCurrentUniversityId();
          return true;
        }

        if (context.surface === "web") {
          return storedUser.role === "student"
            && storedUser.universityId === await context.getCurrentUniversityId();
        }

        if (storedUser.role === "super_admin") return storedUser.universityId === null;
        return storedUser.role === "university_admin"
          && storedUser.universityId === await context.getCurrentUniversityId();
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
