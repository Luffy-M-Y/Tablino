export const GOOGLE_AUTH_CONTEXT_TTL_MS = 60_000;

export type GoogleAuthContext = {
  email: string;
  universityId: string | null;
  at: number;
};

export type GoogleAuthSurface = "admin" | "web";

export class GoogleAuthContextStore {
  private readonly contexts = new Map<string, GoogleAuthContext>();

  record(providerAccountId: string, context: GoogleAuthContext, now: number): boolean {
    this.prune(now);

    const existing = this.contexts.get(providerAccountId);
    if (
      existing
      && (
        existing.email !== context.email
        || existing.universityId !== context.universityId
      )
    ) {
      return false;
    }

    this.contexts.set(providerAccountId, context);
    return true;
  }

  consume(providerAccountId: string, now: number): GoogleAuthContext | null {
    const context = this.contexts.get(providerAccountId);
    this.contexts.delete(providerAccountId);
    if (!context || now - context.at >= GOOGLE_AUTH_CONTEXT_TTL_MS) return null;
    return context;
  }

  delete(providerAccountId: string): void {
    this.contexts.delete(providerAccountId);
  }

  has(providerAccountId: string): boolean {
    return this.contexts.has(providerAccountId);
  }

  private prune(now: number): void {
    for (const [providerAccountId, context] of this.contexts) {
      if (now - context.at >= GOOGLE_AUTH_CONTEXT_TTL_MS) {
        this.contexts.delete(providerAccountId);
      }
    }
  }
}

export const googleAuthContexts = new GoogleAuthContextStore();

export async function recordGoogleAuthContext(options: {
  provider: string;
  providerAccountId: string;
  email: string;
  surface: GoogleAuthSurface;
  resolveGoogleUniversityId?: () => Promise<string | null>;
  getCurrentUniversityId: () => Promise<string>;
  now: number;
  store: GoogleAuthContextStore;
}): Promise<{ accepted: boolean; universityId: string | null }> {
  const {
    provider,
    providerAccountId,
    email,
    surface,
    resolveGoogleUniversityId,
    getCurrentUniversityId,
    now,
    store,
  } = options;

  if (provider !== "google") return { accepted: false, universityId: null };
  const contextKey = getGoogleAuthContextKey(surface, providerAccountId);

  let universityId: string | null = null;
  if (resolveGoogleUniversityId) {
    universityId = await resolveGoogleUniversityId();
    if (!universityId) {
      return { accepted: false, universityId: null };
    }
  } else if (surface === "web") {
    universityId = await getCurrentUniversityId();
  }

  const accepted = store.record(contextKey, {
    email,
    universityId,
    at: now,
  }, now);

  return { accepted, universityId: accepted ? universityId : null };
}

export function consumeGoogleAuthContext(
  store: GoogleAuthContextStore,
  providerAccountId: string,
  now: number,
  surface: GoogleAuthSurface = "web",
): GoogleAuthContext | null {
  return store.consume(getGoogleAuthContextKey(surface, providerAccountId), now);
}

export function deleteGoogleAuthContext(
  store: GoogleAuthContextStore,
  providerAccountId: string,
  surface: GoogleAuthSurface,
): void {
  store.delete(getGoogleAuthContextKey(surface, providerAccountId));
}

function getGoogleAuthContextKey(surface: GoogleAuthSurface, providerAccountId: string): string {
  return `${surface}:${providerAccountId}`;
}
