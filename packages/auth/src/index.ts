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
import {
  db,
  googleEmailMatchesUser,
  markGoogleEmailVerified,
  schema,
  checkAdminInvitationGoogleEligibility,
  createPendingAdminInvitationGoogleUser,
  completeAdminInvitationGoogleAccount,
  checkAdminSuperLoginGoogleEligibility,
  createAdminSuperLoginOauthTransferCode,
} from "@tablino/db";
import type {} from "./next-auth";
import { createGoogleSignupToken } from "./google-signup-token";
import { shouldUseSecureCookies } from "./secure-cookies";
import { createUniversitySignupToken } from "./university-signup-token";
import { createGoogleExistingAccountToken } from "./google-existing-account-token";
import { createSuperGoogleExistingAccountTokenEnv } from "./google-super-existing-account-token";
import {
  AUTH_ADMIN_GOOGLE_ERROR_PATH,
  AUTH_ADMIN_GOOGLE_EXISTING_ACCOUNT,
  decideAdminGoogleSignIn,
  isAdminCentralGoogleLinkAllowed,
  shouldMarkGoogleEmailVerified,
} from "./admin-google-signin";
import { decideAdminSuperGoogleSignIn } from "./admin-super-google-signin";
import type { AuthRole } from "./roles";
import { createAuthGuards, type AuthSurface, type GuardRole } from "./guards";
import {
  consumeGoogleAuthContext,
  deleteGoogleAuthContext,
  googleAuthContexts,
  recordGoogleAuthContext,
} from "./google-auth-context";

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

export type AdminInvitationOauthContext = {
  invitationId: string;
  transactionId: string;
};

export type AdminSuperLoginOauthContext = {
  flow: "super_login";
  transactionId: string;
};

type AuthOptionsContext = {
  surface: AuthSurface;
  getCurrentUniversityId: () => Promise<string>;
  resolveGoogleUniversityId?: () => Promise<unknown>;
  resolveAdminInvitationOauthContext?: () => Promise<{ invitationId: string; transactionId: string } | null>;
  resolveGoogleSignupUrl?: (universityId: string, token: string) => Promise<string | null>;
  resolveGoogleExistingAccountUrl?: (universityId: string, token: string) => Promise<string | null>;
  resolveGoogleSuperExistingAccountUrl?: (token: string) => Promise<string | null>;
  resolveGoogleSuperTransferUrl?: (code: string) => Promise<string | null>;
  isAuthAdminCentral?: boolean;
  errorPage?: string;
  checkAdminInvitationGoogleEligibility?: typeof checkAdminInvitationGoogleEligibility;
  createPendingAdminInvitationGoogleUser?: typeof createPendingAdminInvitationGoogleUser;
  completeAdminInvitationGoogleAccount?: typeof completeAdminInvitationGoogleAccount;
  checkSuperLoginGoogleEligibility?: typeof checkAdminSuperLoginGoogleEligibility;
  createSuperLoginTransferCode?: typeof createAdminSuperLoginOauthTransferCode;
  getUserById?: (id: string) => Promise<AuthAdapterUser | null>;
  getUserByEmail?: (email: string) => Promise<AuthAdapterUser | null>;
  getUserByAccount?: (provider: string, providerAccountId: string) => Promise<AuthAdapterUser | null>;
  getSuperAdminSecurityDetails?: (userId: string) => Promise<{
    passwordHash: string | null;
    revokedAt: Date | null;
  } | null>;
};

async function getAdminInvitationContext(
  context: AuthOptionsContext,
): Promise<AdminInvitationOauthContext | null> {
  if (context.resolveAdminInvitationOauthContext) {
    const ctx = await context.resolveAdminInvitationOauthContext();
    if (ctx && typeof ctx.invitationId === "string" && typeof ctx.transactionId === "string") {
      return ctx;
    }
  }
  if (context.resolveGoogleUniversityId) {
    try {
      const res = await (context.resolveGoogleUniversityId as () => Promise<unknown>)();
      if (
        res !== null
        && typeof res === "object"
        && "invitationId" in res
        && "transactionId" in res
        && typeof (res as any).invitationId === "string"
        && typeof (res as any).transactionId === "string"
      ) {
        return res as AdminInvitationOauthContext;
      }
    } catch {
      return null;
    }
  }
  return null;
}

async function getAdminSuperLoginContext(
  context: AuthOptionsContext,
): Promise<AdminSuperLoginOauthContext | null> {
  if (context.resolveGoogleUniversityId) {
    try {
      const res = await (context.resolveGoogleUniversityId as () => Promise<unknown>)();
      if (res !== null && typeof res === "object") {
        const obj = res as Record<string, unknown>;
        if (
          obj.flow === "super_login"
          && typeof obj.transactionId === "string"
        ) {
          return {
            flow: "super_login",
            transactionId: obj.transactionId,
          };
        }
      }
    } catch {
      return null;
    }
  }
  return null;
}

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

async function getSuperAdminSecurityDetails(userId: string): Promise<{
  passwordHash: string | null;
  revokedAt: Date | null;
} | null> {
  const [row] = await db.select({
    passwordHash: schema.users.passwordHash,
    revokedAt: schema.users.revokedAt,
  })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  return row ? {
    passwordHash: row.passwordHash,
    revokedAt: row.revokedAt,
  } : null;
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
  const findUserById = context.getUserById ?? getUserById;
  const findUserByEmail = context.getUserByEmail ?? getUserByEmail;
  const findUserByAccount = context.getUserByAccount ?? getUserByAccount;

  return {
    async createUser(user: Omit<AdapterUser, "id">) {
      const superLoginContext = await getAdminSuperLoginContext(context);
      if (superLoginContext !== null) {
        throw new Error("La création de compte est interdite dans le flux de connexion super admin.");
      }

      const invitationContext = await getAdminInvitationContext(context);
      if (invitationContext !== null) {
        if (!user.email) {
          throw new Error("L'e-mail est requis pour créer un compte invité.");
        }
        const createPending =
          context.createPendingAdminInvitationGoogleUser ?? createPendingAdminInvitationGoogleUser;
        const pendingUserId = await createPending({
          invitationId: invitationContext.invitationId,
          transactionId: invitationContext.transactionId,
          email: user.email,
          name: user.name ?? null,
          image: user.image ?? null,
        });
        if (!pendingUserId) {
          throw new Error("Impossible de créer le compte invité Google.");
        }
        const created = await findUserById(pendingUserId);
        if (!created) {
          throw new Error("Utilisateur invité introuvable.");
        }
        return created;
      }

      throw new Error("La création de compte par Google exige un code d'accès.");
    },

    async getUser(id) {
      return findUserById(id);
    },

    async getUserByEmail(email) {
      return findUserByEmail(email);
    },

    async getUserByAccount({ provider, providerAccountId }) {
      return findUserByAccount(provider, providerAccountId);
    },

    async updateUser(user) {
      const changes: Partial<typeof schema.users.$inferInsert> = {};
      if (user.name !== undefined) changes.name = user.name;
      if (user.email !== undefined) changes.email = user.email;
      if (user.emailVerified !== undefined) changes.emailVerified = user.emailVerified;
      if (user.image !== undefined) changes.image = user.image;

      if (Object.keys(changes).length === 0) {
        const stored = await findUserById(user.id);
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
      const superLoginContext = await getAdminSuperLoginContext(context);
      if (superLoginContext !== null) {
        throw new Error("La liaison de compte est interdite dans le flux de connexion super admin.");
      }

      const invitationContext = await getAdminInvitationContext(context);
      if (invitationContext !== null) {
        const googleContext = await consumeGoogleAuthContext(
          googleAuthContexts,
          account.providerAccountId,
          Date.now(),
          context.surface,
        );
        if (!googleContext) throw new Error("Liaison Google refusee.");

        const completeGoogle =
          context.completeAdminInvitationGoogleAccount ?? completeAdminInvitationGoogleAccount;
        const completed = await completeGoogle({
          invitationId: invitationContext.invitationId,
          transactionId: invitationContext.transactionId,
          userId: account.userId,
          provider: "google",
          providerAccountId: account.providerAccountId,
        });
        if (!completed) throw new Error("Échec de la liaison du compte invité Google.");
        return account;
      }

      const googleContext = await consumeGoogleAuthContext(
        googleAuthContexts,
        account.providerAccountId,
        Date.now(),
        context.surface,
      );
      if (!googleContext) throw new Error("Liaison Google refusee.");
      if (!isAdminCentralGoogleLinkAllowed(context.isAuthAdminCentral === true)) {
        throw new Error("La liaison Google doit être effectuée par le parcours explicite d'inscription admin.");
      }

      const user = await findUserById(account.userId);
      if (
        !user
        || !googleEmailMatchesUser(user.email, googleContext.email)
        || (
          account.provider === "google"
          && context.surface === "web"
          && (
            !googleContext.universityId
            || user.universityId !== googleContext.universityId
          )
        )
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
      if (linked && shouldMarkGoogleEmailVerified(context.surface)) {
        await markGoogleEmailVerified(account.userId, new Date());
      }
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
  const secureCookies = shouldUseSecureCookies();
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
  const pages: { signIn?: string; error?: string } = {};
  if (context.surface === "admin") pages.signIn = "/login";
  if (context.errorPage) pages.error = context.errorPage;
  if (context.surface === "admin" && context.isAuthAdminCentral) {
    pages.error = AUTH_ADMIN_GOOGLE_ERROR_PATH;
    // Hôte central : /login n'y est pas servi ; next-auth passe par la page de connexion
    // après un échec du rappel Google (/api/auth/error puis /api/auth/signin).
    pages.signIn = AUTH_ADMIN_GOOGLE_ERROR_PATH;
  }

  return {
    adapter: createDrizzleAdapter(context),
    ...(Object.keys(pages).length > 0 ? { pages } : {}),
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
        const googleContext = await recordGoogleAuthContext({
          provider: account.provider,
          providerAccountId: account.providerAccountId,
          email,
          surface: context.surface,
          resolveGoogleUniversityId: context.resolveGoogleUniversityId,
          resolveAdminInvitationOauthContext: context.resolveAdminInvitationOauthContext,
          getCurrentUniversityId: context.getCurrentUniversityId,
          now,
          store: googleAuthContexts,
        });
        if (!googleContext.accepted) return false;

        const findUserByAcc = context.getUserByAccount ?? getUserByAccount;
        const findUserByEm = context.getUserByEmail ?? getUserByEmail;
        const linkedUser = await findUserByAcc(account.provider, account.providerAccountId);
        const emailUser = linkedUser ? null : await findUserByEm(email);

        const invitationContext = await getAdminInvitationContext(context);
        if (invitationContext !== null) {
          const checkEligibility =
            context.checkAdminInvitationGoogleEligibility ?? checkAdminInvitationGoogleEligibility;
          const eligibility = await checkEligibility({
            invitationId: invitationContext.invitationId,
            transactionId: invitationContext.transactionId,
            email,
          });
          if (!eligibility.ok) {
            await deleteGoogleAuthContext(googleAuthContexts, account.providerAccountId, context.surface);
            return false;
          }

          // Aucune liaison automatique à un compte existant. Le rôle super_admin ne passe jamais.
          if (emailUser || linkedUser) {
            const existing = linkedUser ?? emailUser;
            if (existing) {
              if (existing.role === "super_admin") {
                await deleteGoogleAuthContext(googleAuthContexts, account.providerAccountId, context.surface);
                return false;
              }
              if (!eligibility.pendingUserId || existing.id !== eligibility.pendingUserId) {
                await deleteGoogleAuthContext(googleAuthContexts, account.providerAccountId, context.surface);
                return false;
              }
            }
          }

          return true;
        }

        const superLoginContext = await getAdminSuperLoginContext(context);
        if (superLoginContext !== null) {
          const safeDeleteGoogleAuthContext = async () => {
            try {
              await deleteGoogleAuthContext(googleAuthContexts, account.providerAccountId, context.surface);
            } catch {
              // Ignore l'échec de suppression du contexte pour garantir le renvoi du refus générique.
            }
          };

          const logSuperAuthRefusal = (code: string) => {
            try {
              console.warn(JSON.stringify({ code }));
            } catch {
              // Si le journal lui-même échoue, le retour ne change jamais.
            }
          };

          const targetUser = emailUser ?? linkedUser ?? (await findUserByEm(email));
          if (!targetUser) {
            await safeDeleteGoogleAuthContext();
            logSuperAuthRefusal("google_super_user_not_found");
            return AUTH_ADMIN_GOOGLE_ERROR_PATH;
          }

          // Refus explicite et immédiat si targetUser.role === "super_admin" (le chef).
          if (targetUser.role === "super_admin") {
            await safeDeleteGoogleAuthContext();
            logSuperAuthRefusal("google_super_chief_denied");
            return AUTH_ADMIN_GOOGLE_ERROR_PATH;
          }

          const readSecurity = context.getSuperAdminSecurityDetails ?? getSuperAdminSecurityDetails;
          let userSecurity: { passwordHash: string | null; revokedAt: Date | null } | null;
          try {
            userSecurity = await readSecurity(targetUser.id);
          } catch {
            await safeDeleteGoogleAuthContext();
            logSuperAuthRefusal("google_super_security_unavailable");
            return AUTH_ADMIN_GOOGLE_ERROR_PATH;
          }

          if (!userSecurity) {
            await safeDeleteGoogleAuthContext();
            logSuperAuthRefusal("google_super_security_unavailable");
            return AUTH_ADMIN_GOOGLE_ERROR_PATH;
          }

          if (userSecurity.revokedAt !== null) {
            await safeDeleteGoogleAuthContext();
            logSuperAuthRefusal("google_super_revoked");
            return AUTH_ADMIN_GOOGLE_ERROR_PATH;
          }

          const hasLinkedGoogle = linkedUser !== null && linkedUser.id === targetUser.id;
          if (hasLinkedGoogle) {
            const checkEligibility =
              context.checkSuperLoginGoogleEligibility ?? checkAdminSuperLoginGoogleEligibility;
            let eligibility: { ok: boolean; userId?: string | null };
            try {
              eligibility = await checkEligibility({
                transactionId: superLoginContext.transactionId,
                email: email.toLowerCase(),
                providerAccountId: account.providerAccountId,
              });
            } catch {
              await safeDeleteGoogleAuthContext();
              logSuperAuthRefusal("google_super_eligibility_error");
              return AUTH_ADMIN_GOOGLE_ERROR_PATH;
            }

            if (!eligibility?.ok) {
              await safeDeleteGoogleAuthContext();
              logSuperAuthRefusal("google_super_eligibility_denied");
              return AUTH_ADMIN_GOOGLE_ERROR_PATH;
            }

            const createTransferCode =
              context.createSuperLoginTransferCode ?? createAdminSuperLoginOauthTransferCode;
            let code: string | null;
            try {
              code = await createTransferCode({
                transactionId: superLoginContext.transactionId,
                userId: targetUser.id,
              });
            } catch {
              await safeDeleteGoogleAuthContext();
              logSuperAuthRefusal("google_super_transfer_failed");
              return AUTH_ADMIN_GOOGLE_ERROR_PATH;
            }

            if (!code) {
              await safeDeleteGoogleAuthContext();
              logSuperAuthRefusal("google_super_transfer_failed");
              return AUTH_ADMIN_GOOGLE_ERROR_PATH;
            }

            let redirectUrl: string | null = null;
            try {
              redirectUrl = context.resolveGoogleSuperTransferUrl
                ? await context.resolveGoogleSuperTransferUrl(code)
                : null;
            } catch {
              await safeDeleteGoogleAuthContext();
              logSuperAuthRefusal("google_super_transfer_failed");
              return AUTH_ADMIN_GOOGLE_ERROR_PATH;
            }

            if (!redirectUrl) {
              await safeDeleteGoogleAuthContext();
              logSuperAuthRefusal("google_super_transfer_failed");
              return AUTH_ADMIN_GOOGLE_ERROR_PATH;
            }

            await safeDeleteGoogleAuthContext();
            return redirectUrl;
          }

          // Sinon (compte à mot de passe seulement, sans compte Google lié)
          const decision = decideAdminSuperGoogleSignIn({
            isAuthAdminCentral: context.isAuthAdminCentral === true,
            user: {
              role: targetUser.role,
              universityId: targetUser.universityId,
              revokedAt: userSecurity.revokedAt,
              emailVerified: targetUser.emailVerified,
              passwordHash: userSecurity.passwordHash,
            },
          });

          if (!decision) {
            await safeDeleteGoogleAuthContext();
            logSuperAuthRefusal("google_super_decision_denied");
            return AUTH_ADMIN_GOOGLE_ERROR_PATH;
          }

          try {
            const existingToken = createSuperGoogleExistingAccountTokenEnv({
              email,
              now,
            });
            const redirectUrl = await context.resolveGoogleSuperExistingAccountUrl?.(existingToken);
            await safeDeleteGoogleAuthContext();
            if (!redirectUrl) {
              logSuperAuthRefusal("google_super_existing_url_failed");
              return AUTH_ADMIN_GOOGLE_ERROR_PATH;
            }
            return redirectUrl;
          } catch {
            await safeDeleteGoogleAuthContext();
            logSuperAuthRefusal("google_super_existing_url_failed");
            return AUTH_ADMIN_GOOGLE_ERROR_PATH;
          }
        }
        if (emailUser) {
          let existingAccount: { userId: string } | undefined;
          try {
            const accounts = await db.select({ userId: schema.accounts.userId })
              .from(schema.accounts)
              .where(and(
                eq(schema.accounts.userId, emailUser.id),
                eq(schema.accounts.provider, "google"),
              ))
              .limit(1);
            if (accounts.length > 0) existingAccount = accounts[0];
          } catch {
            if (context.surface === "admin" && context.isAuthAdminCentral) {
              await deleteGoogleAuthContext(googleAuthContexts, account.providerAccountId, context.surface);
              return AUTH_ADMIN_GOOGLE_ERROR_PATH;
            }
            throw new Error("Impossible de vérifier le compte Google lié.");
          }
          // Utilisateur trouvé par e-mail avec un compte Google déjà lié : refus.
          if (existingAccount) {
            if (context.surface === "admin" && context.isAuthAdminCentral) {
              await deleteGoogleAuthContext(googleAuthContexts, account.providerAccountId, context.surface);
              return AUTH_ADMIN_GOOGLE_ERROR_PATH;
            }
            return false;
          }
          if (context.surface === "admin" && context.isAuthAdminCentral) {
            const decision = decideAdminGoogleSignIn({
              isAuthAdminCentral: true,
              user: emailUser,
              googleUniversityId: googleContext.universityId,
              hasGoogleAccountLinked: false,
            });
            if (decision !== AUTH_ADMIN_GOOGLE_EXISTING_ACCOUNT) {
              await deleteGoogleAuthContext(googleAuthContexts, account.providerAccountId, context.surface);
              return AUTH_ADMIN_GOOGLE_ERROR_PATH;
            }

            const universityId = emailUser.universityId;
            if (!universityId) {
              await deleteGoogleAuthContext(googleAuthContexts, account.providerAccountId, context.surface);
              return AUTH_ADMIN_GOOGLE_ERROR_PATH;
            }
            try {
              const users = await db.select({
                passwordHash: schema.users.passwordHash,
                revokedAt: schema.users.revokedAt,
              })
                .from(schema.users)
                .where(eq(schema.users.id, emailUser.id))
                .limit(1);
              if (
                !(users.length > 0)
                || users[0].passwordHash === null
                || users[0].revokedAt !== null
              ) {
                await deleteGoogleAuthContext(googleAuthContexts, account.providerAccountId, context.surface);
                return AUTH_ADMIN_GOOGLE_ERROR_PATH;
              }
              const existingToken = createGoogleExistingAccountToken({
                email,
                universityId,
                now,
                secret: process.env.NEXTAUTH_SECRET ?? "",
              });
              const redirectUrl = await context.resolveGoogleExistingAccountUrl?.(
                universityId,
                existingToken,
              );
              await deleteGoogleAuthContext(googleAuthContexts, account.providerAccountId, context.surface);
              return redirectUrl ?? AUTH_ADMIN_GOOGLE_ERROR_PATH;
            } catch {
              try {
                await deleteGoogleAuthContext(googleAuthContexts, account.providerAccountId, context.surface);
              } catch {}
              return AUTH_ADMIN_GOOGLE_ERROR_PATH;
            }
          }
          // Surface web, emailUser sans compte lié : refus de liaison + redirection informative.
          if (context.surface === "web") {
            await deleteGoogleAuthContext(googleAuthContexts, account.providerAccountId, context.surface);
            if (
              emailUser.role === "student"
              && googleContext.universityId !== null
              && emailUser.universityId === googleContext.universityId
              && context.resolveGoogleExistingAccountUrl
            ) {
              const existingToken = createGoogleExistingAccountToken({
                email,
                universityId: googleContext.universityId,
                now,
                secret: process.env.NEXTAUTH_SECRET ?? "",
              });
              const redirectUrl = await context.resolveGoogleExistingAccountUrl(
                googleContext.universityId,
                existingToken,
              );
              if (redirectUrl) return redirectUrl;
            }
            return false;
          }
        }
        const storedUser = linkedUser ?? emailUser;

        if (!storedUser) {
          if (context.surface === "admin" && context.isAuthAdminCentral) {
            await deleteGoogleAuthContext(googleAuthContexts, account.providerAccountId, context.surface);
            return decideAdminGoogleSignIn({
              isAuthAdminCentral: true,
              user: null,
              googleUniversityId: googleContext.universityId,
            }) ?? false;
          }
          const payload = {
            email: email,
            name: user.name ?? null,
            image: user.image ?? null,
            providerAccountId: account.providerAccountId,
            universityId: googleContext.universityId,
          };
          if (context.surface === "web") {
            const signupToken = createGoogleSignupToken(payload);
            await deleteGoogleAuthContext(googleAuthContexts, account.providerAccountId, context.surface);
            if (context.resolveGoogleSignupUrl) {
              if (!googleContext.universityId) return false;
              const signupUrl = await context.resolveGoogleSignupUrl(googleContext.universityId, signupToken);
              if (signupUrl) return signupUrl;
              return false;
            }
            return "/inscription/google?token=" + encodeURIComponent(signupToken);
          }
          await deleteGoogleAuthContext(googleAuthContexts, account.providerAccountId, context.surface);
          return "/university-signup?token=" + encodeURIComponent(createUniversitySignupToken(payload));
        }

        if (context.surface === "web") {
          return storedUser.role === "student"
            && storedUser.universityId === googleContext.universityId;
        }

        const decision = decideAdminGoogleSignIn({
          isAuthAdminCentral: context.isAuthAdminCentral === true,
          user: storedUser,
          googleUniversityId: googleContext.universityId,
          hasGoogleAccountLinked: linkedUser !== null,
        });
        if (decision === AUTH_ADMIN_GOOGLE_ERROR_PATH) {
          await deleteGoogleAuthContext(googleAuthContexts, account.providerAccountId, context.surface);
        }
        return decision ?? false;
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
      universityName: schema.universities.name,
      universityAcronym: schema.universities.acronym,
      universityStatus: schema.universities.status,
      revokedAt: schema.users.revokedAt,
      trialEndsAt: schema.users.trialEndsAt,
      subscriptionExpiresAt: schema.users.subscriptionExpiresAt,
      currentPlan: schema.users.currentPlan,
    }).from(schema.users)
      .leftJoin(schema.universities, eq(schema.users.universityId, schema.universities.id))
      .where(eq(schema.users.id, userId))
      .limit(1);
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
  createUniversitySignupToken,
  verifyUniversitySignupToken,
  UNIVERSITY_SIGNUP_TOKEN_TTL_MS,
} from "./university-signup-token";
export type { UniversitySignupPayload } from "./university-signup-token";
export {
  createEmailVerificationToken,
  verifyEmailVerificationToken,
  getEmailVerificationCookieConfig,
  EMAIL_VERIFICATION_TOKEN_TTL_MS,
} from "./email-verification-token";
export {
  createPasswordResetToken,
  verifyPasswordResetToken,
  getPasswordResetCookieConfig,
  PASSWORD_RESET_TOKEN_TTL_MS,
  createAdminPasswordResetToken,
  verifyAdminPasswordResetToken,
  createPasswordResetConfirmedToken,
  verifyPasswordResetConfirmedToken,
  getPasswordResetConfirmedCookieConfig,
  PASSWORD_RESET_CONFIRMED_TOKEN_TTL_MS,
  createAdminPasswordResetConfirmedToken,
  verifyAdminPasswordResetConfirmedToken,
} from "./password-reset-token";
export {
  TURNSTILE_ACTIONS,
  verifyTurnstileToken,
} from "./turnstile";
export type {
  TurnstileAction,
  TurnstileFailureReason,
  TurnstileResult,
} from "./turnstile";
export { getCloudflareClientIp } from "./client-ip";
export {
  createGoogleExistingAccountToken,
  verifyGoogleExistingAccountToken,
  createGoogleExistingAccountTokenEnv,
  verifyGoogleExistingAccountTokenEnv,
  GOOGLE_EXISTING_ACCOUNT_TOKEN_TTL_MS,
} from "./google-existing-account-token";
export {
  createSuperGoogleExistingAccountToken,
  verifySuperGoogleExistingAccountToken,
  createSuperGoogleExistingAccountTokenEnv,
  verifySuperGoogleExistingAccountTokenEnv,
  SUPER_GOOGLE_EXISTING_ACCOUNT_TOKEN_TTL_MS,
} from "./google-super-existing-account-token";
export {
  decideAdminSuperGoogleSignIn,
} from "./admin-super-google-signin";
export type { AdminSuperGoogleUser } from "./admin-super-google-signin";
