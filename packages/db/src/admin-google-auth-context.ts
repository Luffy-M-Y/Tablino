import { and, eq, gt, lte } from "drizzle-orm";
import { db } from "./client";
import * as schema from "./schema";

export type AdminGoogleAuthContextRecord = {
  email: string;
  universityId: string | null;
  at: Date;
};

export type AdminGoogleAuthContextRepository = {
  record: (input: {
    providerAccountId: string;
    surface: "admin" | "web";
    email: string;
    universityId: string | null;
    at: Date;
    expiresAt: Date;
  }) => Promise<{ accepted: boolean }>;
  consume: (input: {
    providerAccountId: string;
    surface: "admin" | "web";
    now: Date;
  }) => Promise<AdminGoogleAuthContextRecord | null>;
  delete: (input: {
    providerAccountId: string;
    surface: "admin" | "web";
  }) => Promise<void>;
  pruneExpired: (now: Date) => Promise<void>;
};

export type AdminGoogleAuthContextDependencies = {
  repository: AdminGoogleAuthContextRepository;
};

export function createAdminGoogleAuthContextService({
  repository,
}: AdminGoogleAuthContextDependencies) {
  return {
    async recordGoogleAuthContext(input: {
      providerAccountId: string;
      surface: "admin" | "web";
      email: string;
      universityId: string | null;
      now: Date;
      ttlMs: number;
    }): Promise<{ accepted: boolean }> {
      return repository.record({
        providerAccountId: input.providerAccountId,
        surface: input.surface,
        email: input.email,
        universityId: input.universityId,
        at: input.now,
        expiresAt: new Date(input.now.getTime() + input.ttlMs),
      });
    },

    async consumeGoogleAuthContext(input: {
      providerAccountId: string;
      surface: "admin" | "web";
      now: Date;
    }): Promise<AdminGoogleAuthContextRecord | null> {
      return repository.consume(input);
    },

    async deleteGoogleAuthContext(input: {
      providerAccountId: string;
      surface: "admin" | "web";
    }): Promise<void> {
      return repository.delete(input);
    },

    async pruneExpiredGoogleAuthContexts(now: Date): Promise<void> {
      return repository.pruneExpired(now);
    },
  };
}

export function createAdminGoogleAuthContextDrizzleRepository(
  database: typeof db = db,
): AdminGoogleAuthContextRepository {
  return {
    async record({ providerAccountId, surface, email, universityId, at, expiresAt }) {
      return database.transaction(async (transaction) => {
        await transaction
          .delete(schema.adminGoogleAuthContexts)
          .where(lte(schema.adminGoogleAuthContexts.expiresAt, at));

        const existing = await transaction
          .select({
            id: schema.adminGoogleAuthContexts.id,
            email: schema.adminGoogleAuthContexts.email,
            universityId: schema.adminGoogleAuthContexts.universityId,
          })
          .from(schema.adminGoogleAuthContexts)
          .where(and(
            eq(schema.adminGoogleAuthContexts.providerAccountId, providerAccountId),
            eq(schema.adminGoogleAuthContexts.surface, surface),
          ))
          .limit(1);

        if (existing.length > 0) {
          const row = existing[0];
          if (row.email !== email || row.universityId !== universityId) {
            return { accepted: false };
          }
          await transaction
            .update(schema.adminGoogleAuthContexts)
            .set({ at, expiresAt })
            .where(eq(schema.adminGoogleAuthContexts.id, row.id));
          return { accepted: true };
        }

        const inserted = await transaction
          .insert(schema.adminGoogleAuthContexts)
          .values({ providerAccountId, surface, email, universityId, at, expiresAt })
          .onConflictDoNothing({
            target: [
              schema.adminGoogleAuthContexts.providerAccountId,
              schema.adminGoogleAuthContexts.surface,
            ],
          })
          .returning({ id: schema.adminGoogleAuthContexts.id });

        if (inserted.length > 0) {
          return { accepted: true };
        }

        const reloaded = await transaction
          .select({
            id: schema.adminGoogleAuthContexts.id,
            email: schema.adminGoogleAuthContexts.email,
            universityId: schema.adminGoogleAuthContexts.universityId,
          })
          .from(schema.adminGoogleAuthContexts)
          .where(and(
            eq(schema.adminGoogleAuthContexts.providerAccountId, providerAccountId),
            eq(schema.adminGoogleAuthContexts.surface, surface),
          ))
          .limit(1);

        if (!(reloaded.length > 0)) {
          return { accepted: false };
        }

        const conflictRow = reloaded[0];
        if (conflictRow.email !== email || conflictRow.universityId !== universityId) {
          return { accepted: false };
        }

        await transaction
          .update(schema.adminGoogleAuthContexts)
          .set({ at, expiresAt })
          .where(eq(schema.adminGoogleAuthContexts.id, conflictRow.id));
        return { accepted: true };
      });
    },

    async consume({ providerAccountId, surface, now }) {
      const rows = await database
        .delete(schema.adminGoogleAuthContexts)
        .where(and(
          eq(schema.adminGoogleAuthContexts.providerAccountId, providerAccountId),
          eq(schema.adminGoogleAuthContexts.surface, surface),
          gt(schema.adminGoogleAuthContexts.expiresAt, now),
        ))
        .returning({
          email: schema.adminGoogleAuthContexts.email,
          universityId: schema.adminGoogleAuthContexts.universityId,
          at: schema.adminGoogleAuthContexts.at,
        });
      return rows.length > 0 ? rows[0] : null;
    },

    async delete({ providerAccountId, surface }) {
      await database
        .delete(schema.adminGoogleAuthContexts)
        .where(and(
          eq(schema.adminGoogleAuthContexts.providerAccountId, providerAccountId),
          eq(schema.adminGoogleAuthContexts.surface, surface),
        ));
    },

    async pruneExpired(now) {
      await database
        .delete(schema.adminGoogleAuthContexts)
        .where(lte(schema.adminGoogleAuthContexts.expiresAt, now));
    },
  };
}

const service = createAdminGoogleAuthContextService({
  repository: createAdminGoogleAuthContextDrizzleRepository(db),
});

export const recordGoogleAuthContext = service.recordGoogleAuthContext;
export const consumeGoogleAuthContext = service.consumeGoogleAuthContext;
export const deleteGoogleAuthContext = service.deleteGoogleAuthContext;
export const pruneExpiredGoogleAuthContexts = service.pruneExpiredGoogleAuthContexts;
