import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, inArray, isNull } from "drizzle-orm";
import { db } from "./client";
import * as schema from "./schema";

export const OAUTH_START_TICKET_TTL_MS = 5 * 60 * 1000;

export type OauthStartTicketSurface = "web" | "admin";

export type OauthUniversityStatus = "pending" | "approved" | "active";

/**
 * Statuts d'université admis pour la connexion Google.
 * Web : université active seulement. Admin : l'admin d'une université en attente
 * ou approuvée doit pouvoir se connecter (attente, puis contrat de partenariat).
 */
export function getOauthUniversityStatuses(surface: OauthStartTicketSurface): readonly OauthUniversityStatus[] {
  return surface === "admin" ? ["pending", "approved", "active"] : ["active"];
}

export type OauthStartTicketRepository = {
  createForEligibleUniversity: (
    universityId: string,
    ticketHash: string,
    expiresAt: Date,
    statuses: readonly OauthUniversityStatus[],
  ) => Promise<boolean>;
  consume: (
    ticketHash: string,
    now: Date,
    consumedAt: Date,
  ) => Promise<string | null>;
};

export type OauthStartTicketDependencies = {
  repository: OauthStartTicketRepository;
  now?: () => Date;
  randomBytes?: (size: number) => Buffer;
};

export class OauthStartTicketError extends Error {
  constructor() {
    super("Université inconnue ou inactive.");
    this.name = "OauthStartTicketError";
  }
}

function hashTicket(ticket: string, surface: OauthStartTicketSurface): string {
  return createHash("sha256").update(ticket + ":" + surface).digest("hex");
}

function isValidTicket(ticket: string): boolean {
  if (!/^[A-Za-z0-9_-]{43}$/.test(ticket)) return false;
  const bytes = Buffer.from(ticket, "base64url");
  return bytes.length === 32 && bytes.toString("base64url") === ticket;
}

export function createOauthStartTicketService({
  repository,
  now = () => new Date(),
  randomBytes: createRandomBytes = randomBytes,
}: OauthStartTicketDependencies) {
  return {
    async createOauthStartTicket(universityId: string, surface: OauthStartTicketSurface): Promise<string> {
      const createdAt = now();
      const ticketBytes = createRandomBytes(32);
      if (ticketBytes.length !== 32) {
        throw new Error("Génération du ticket OAuth invalide.");
      }

      const ticket = ticketBytes.toString("base64url");
      const created = await repository.createForEligibleUniversity(
        universityId,
        hashTicket(ticket, surface),
        new Date(createdAt.getTime() + OAUTH_START_TICKET_TTL_MS),
        getOauthUniversityStatuses(surface),
      );
      if (!created) throw new OauthStartTicketError();
      return ticket;
    },

    async consumeOauthStartTicket(ticket: string, surface: OauthStartTicketSurface): Promise<string | null> {
      if (!isValidTicket(ticket)) return null;
      const consumedAt = now();
      return repository.consume(hashTicket(ticket, surface), consumedAt, consumedAt);
    },
  };
}

const service = createOauthStartTicketService({
  repository: {
    async createForEligibleUniversity(universityId, ticketHash, expiresAt, statuses) {
      return db.transaction(async (transaction) => {
        const [university] = await transaction
          .select({ id: schema.universities.id })
          .from(schema.universities)
          .where(and(
            eq(schema.universities.id, universityId),
            inArray(schema.universities.status, [...statuses]),
          ))
          .for("share")
          .limit(1);
        if (!university) return false;

        const [created] = await transaction
          .insert(schema.oauthStartTickets)
          .values({ universityId, ticketHash, expiresAt })
          .returning({ id: schema.oauthStartTickets.id });
        return Boolean(created);
      });
    },

    async consume(ticketHash, now, consumedAt) {
      const [consumed] = await db
        .update(schema.oauthStartTickets)
        .set({ consumedAt })
        .where(and(
          eq(schema.oauthStartTickets.ticketHash, ticketHash),
          isNull(schema.oauthStartTickets.consumedAt),
          gt(schema.oauthStartTickets.expiresAt, now),
        ))
        .returning({ universityId: schema.oauthStartTickets.universityId });
      return consumed?.universityId ?? null;
    },
  },
});

export const createOauthStartTicket = service.createOauthStartTicket;
export const consumeOauthStartTicket = service.consumeOauthStartTicket;
