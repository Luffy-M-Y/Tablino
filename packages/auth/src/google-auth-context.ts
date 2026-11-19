import {
  consumeGoogleAuthContext as dbConsumeGoogleAuthContext,
  deleteGoogleAuthContext as dbDeleteGoogleAuthContext,
  recordGoogleAuthContext as dbRecordGoogleAuthContext,
} from "@tablino/db";

export const GOOGLE_AUTH_CONTEXT_TTL_MS = 60_000;

export type GoogleAuthContext = {
  email: string;
  universityId: string | null;
  at: number;
};

export type GoogleAuthSurface = "admin" | "web";

export type GoogleAuthContextService = {
  record: (input: {
    providerAccountId: string;
    surface?: GoogleAuthSurface;
    email: string;
    universityId: string | null;
    now: number;
    ttlMs?: number;
  }) => Promise<{ accepted: boolean }>;
  consume: (
    providerAccountId: string,
    now: number,
    surface?: GoogleAuthSurface,
  ) => Promise<GoogleAuthContext | null>;
  delete: (
    providerAccountId: string,
    surface: GoogleAuthSurface,
  ) => Promise<void>;
};

export const googleAuthContexts: GoogleAuthContextService = {
  async record(input) {
    return dbRecordGoogleAuthContext({
      providerAccountId: input.providerAccountId,
      surface: input.surface ?? "web",
      email: input.email,
      universityId: input.universityId,
      now: new Date(input.now),
      ttlMs: input.ttlMs ?? GOOGLE_AUTH_CONTEXT_TTL_MS,
    });
  },

  async consume(providerAccountId, now, surface = "web") {
    const row = await dbConsumeGoogleAuthContext({
      providerAccountId,
      surface,
      now: new Date(now),
    });
    if (!row) return null;
    return {
      email: row.email,
      universityId: row.universityId,
      at: row.at.getTime(),
    };
  },

  async delete(providerAccountId, surface) {
    await dbDeleteGoogleAuthContext({
      providerAccountId,
      surface,
    });
  },
};

export async function recordGoogleAuthContext(options: {
  provider: string;
  providerAccountId: string;
  email: string;
  surface: GoogleAuthSurface;
  resolveGoogleUniversityId?: () => Promise<string | null>;
  getCurrentUniversityId: () => Promise<string>;
  now: number;
  store: GoogleAuthContextService;
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

  let universityId: string | null = null;
  if (resolveGoogleUniversityId) {
    universityId = await resolveGoogleUniversityId();
    if (!universityId) {
      return { accepted: false, universityId: null };
    }
  } else if (surface === "web") {
    universityId = await getCurrentUniversityId();
  }

  const result = await store.record({
    providerAccountId,
    surface,
    email,
    universityId,
    now,
    ttlMs: GOOGLE_AUTH_CONTEXT_TTL_MS,
  });

  return { accepted: result.accepted, universityId: result.accepted ? universityId : null };
}

export async function consumeGoogleAuthContext(
  store: GoogleAuthContextService,
  providerAccountId: string,
  now: number,
  surface: GoogleAuthSurface = "web",
): Promise<GoogleAuthContext | null> {
  return store.consume(providerAccountId, now, surface);
}

export async function deleteGoogleAuthContext(
  store: GoogleAuthContextService,
  providerAccountId: string,
  surface: GoogleAuthSurface,
): Promise<void> {
  await store.delete(providerAccountId, surface);
}
