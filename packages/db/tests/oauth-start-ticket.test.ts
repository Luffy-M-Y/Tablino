import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  createOauthStartTicketService,
  OAUTH_START_TICKET_TTL_MS,
  OauthStartTicketError,
  type OauthStartTicketRepository,
} from "../src/oauth-start-ticket";

const ACTIVE_UNIVERSITY_ID = "university-active";
const NOW = new Date("2026-11-09T12:00:00.000Z");
const RAW_TICKET = Buffer.from("0123456789abcdef0123456789abcdef").toString("base64url");
const RAW_TICKET_HASH = createHash("sha256").update(RAW_TICKET).digest("hex");

function createMemoryRepository({
  activeUniversityIds = [ACTIVE_UNIVERSITY_ID],
  tickets = [],
}: {
  activeUniversityIds?: string[];
  tickets?: Array<{
    universityId: string;
    ticketHash: string;
    expiresAt: Date;
    consumedAt: Date | null;
  }>;
} = {}) {
  const storedTickets = tickets.map((ticket) => ({ ...ticket }));
  let activeIds = new Set(activeUniversityIds);
  let createCount = 0;
  let consumeCount = 0;

  const repository: OauthStartTicketRepository = {
    async createForActiveUniversity(universityId, ticketHash, expiresAt) {
      createCount++;
      if (!activeIds.has(universityId)) return false;
      storedTickets.push({
        universityId,
        ticketHash,
        expiresAt,
        consumedAt: null,
      });
      return true;
    },

    async consume(ticketHash, now, consumedAt) {
      consumeCount++;
      const ticket = storedTickets.find((entry) =>
        entry.ticketHash === ticketHash
        && entry.consumedAt === null
        && entry.expiresAt > now,
      );
      if (!ticket) return null;
      ticket.consumedAt = consumedAt;
      return ticket.universityId;
    },
  };

  return {
    repository,
    storedTickets,
    setActiveUniversityIds(ids: string[]) {
      activeIds = new Set(ids);
    },
    get createCount() {
      return createCount;
    },
    get consumeCount() {
      return consumeCount;
    },
  };
}

function createService(activeUniversityIds = [ACTIVE_UNIVERSITY_ID]) {
  const fake = createMemoryRepository({ activeUniversityIds });
  const service = createOauthStartTicketService({
    repository: fake.repository,
    now: () => new Date(NOW),
    randomBytes: (size) => {
      assert.equal(size, 32);
      return Buffer.from("0123456789abcdef0123456789abcdef");
    },
  });
  return Object.assign(fake, { service });
}

test("creates a 32-byte opaque ticket and stores only its SHA-256 hash", async () => {
  const fake = createService();

  const ticket = await fake.service.createOauthStartTicket(ACTIVE_UNIVERSITY_ID);

  assert.equal(ticket, RAW_TICKET);
  assert.equal(Buffer.from(ticket, "base64url").length, 32);
  assert.equal(fake.createCount, 1);
  assert.equal(fake.storedTickets.length, 1);
  assert.equal(fake.storedTickets[0].universityId, ACTIVE_UNIVERSITY_ID);
  assert.equal(fake.storedTickets[0].ticketHash, RAW_TICKET_HASH);
  assert.notEqual(fake.storedTickets[0].ticketHash, ticket);
  assert.equal(fake.storedTickets[0].expiresAt.getTime(), NOW.getTime() + OAUTH_START_TICKET_TTL_MS);
  assert.equal(fake.storedTickets[0].consumedAt, null);
});

test("refuses an unknown or inactive university without creating a ticket", async () => {
  const fake = createService([]);

  await assert.rejects(
    fake.service.createOauthStartTicket("university-inactive"),
    OauthStartTicketError,
  );
  assert.equal(fake.createCount, 1);
  assert.equal(fake.storedTickets.length, 0);
});

test("consumes a valid ticket and returns its university", async () => {
  const fake = createService();
  await fake.service.createOauthStartTicket(ACTIVE_UNIVERSITY_ID);

  assert.equal(await fake.service.consumeOauthStartTicket(RAW_TICKET), ACTIVE_UNIVERSITY_ID);
});

test("refuses expired tickets", async () => {
  const fake = createMemoryRepository({
    tickets: [{
      universityId: ACTIVE_UNIVERSITY_ID,
      ticketHash: RAW_TICKET_HASH,
      expiresAt: new Date(NOW.getTime() - 1),
      consumedAt: null,
    }],
  });
  const service = createOauthStartTicketService({
    repository: fake.repository,
    now: () => new Date(NOW),
  });

  assert.equal(await service.consumeOauthStartTicket(RAW_TICKET), null);
});

test("refuses replay after a ticket has been consumed", async () => {
  const fake = createService();
  await fake.service.createOauthStartTicket(ACTIVE_UNIVERSITY_ID);

  assert.equal(await fake.service.consumeOauthStartTicket(RAW_TICKET), ACTIVE_UNIVERSITY_ID);
  assert.equal(await fake.service.consumeOauthStartTicket(RAW_TICKET), null);
});

test("refuses malformed tickets without querying the repository", async () => {
  const fake = createService();

  assert.equal(await fake.service.consumeOauthStartTicket("invalid"), null);
  assert.equal(fake.consumeCount, 0);
});

test("only one concurrent consumer can consume a ticket", async () => {
  const fake = createService();
  await fake.service.createOauthStartTicket(ACTIVE_UNIVERSITY_ID);

  const results = await Promise.all([
    fake.service.consumeOauthStartTicket(RAW_TICKET),
    fake.service.consumeOauthStartTicket(RAW_TICKET),
  ]);

  assert.deepEqual(results.sort(), [null, ACTIVE_UNIVERSITY_ID].sort());
  assert.equal(fake.consumeCount, 2);
});
