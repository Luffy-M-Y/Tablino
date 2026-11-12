import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  createOauthTransferCodeService,
  OAUTH_TRANSFER_CODE_TTL_MS,
  OauthTransferCodeError,
  type OauthTransferCodeRepository,
} from "../src/oauth-transfer-code";

const UNIVERSITY_ID = "university-active";
const USER_ID = "user-member";
const OTHER_UNIVERSITY_ID = "university-other";
const NOW = new Date("2026-11-10T10:00:00.000Z");
const RAW_CODE = Buffer.from("0123456789abcdef0123456789abcdef").toString("base64url");
const RAW_CODE_HASH = createHash("sha256").update(RAW_CODE).digest("hex");

type StoredCode = {
  universityId: string;
  userId: string;
  codeHash: string;
  expiresAt: Date;
  consumedAt: Date | null;
};

function createMemoryRepository({
  activeMemberPairs = [[UNIVERSITY_ID, USER_ID]] as Array<[string, string]>,
  codes = [] as StoredCode[],
  revokedUserIds = [] as string[],
} = {}) {
  const stored: StoredCode[] = codes.map((c) => ({ ...c }));
  let activeSet = new Set(activeMemberPairs.map(([u, usr]) => `${u}:${usr}`));
  const revokedSet = new Set(revokedUserIds);
  let createCount = 0;
  let consumeCount = 0;

  const repository: OauthTransferCodeRepository = {
    async createForActiveUniversityMember(universityId, userId, codeHash, expiresAt) {
      createCount++;
      if (!activeSet.has(`${universityId}:${userId}`)) return false;
      if (revokedSet.has(userId)) return false;
      stored.push({ universityId, userId, codeHash, expiresAt, consumedAt: null });
      return true;
    },
    async consume(codeHash, universityId, now, consumedAt) {
      consumeCount++;
      const entry = stored.find((c) =>
        c.codeHash === codeHash
        && c.universityId === universityId
        && c.consumedAt === null
        && c.expiresAt > now,
      );
      if (!entry) return null;
      entry.consumedAt = consumedAt;
      return { userId: entry.userId };
    },
  };

  return {
    repository,
    stored,
    setActivePairs(pairs: Array<[string, string]>) {
      activeSet = new Set(pairs.map(([u, usr]) => `${u}:${usr}`));
    },
    get createCount() { return createCount; },
    get consumeCount() { return consumeCount; },
  };
}

function createService(activePairs: Array<[string, string]> = [[UNIVERSITY_ID, USER_ID]]) {
  const fake = createMemoryRepository({ activeMemberPairs: activePairs });
  const service = createOauthTransferCodeService({
    repository: fake.repository,
    now: () => new Date(NOW),
    randomBytes: (size) => {
      assert.equal(size, 32);
      return Buffer.from("0123456789abcdef0123456789abcdef");
    },
  });
  return Object.assign(fake, { service });
}

test("creates a 32-byte opaque code and stores only its SHA-256 hash", async () => {
  const fake = createService();

  const code = await fake.service.createOauthTransferCode({ universityId: UNIVERSITY_ID, userId: USER_ID });

  assert.equal(code, RAW_CODE);
  assert.equal(Buffer.from(code, "base64url").length, 32);
  assert.equal(fake.createCount, 1);
  assert.equal(fake.stored.length, 1);
  assert.equal(fake.stored[0].universityId, UNIVERSITY_ID);
  assert.equal(fake.stored[0].userId, USER_ID);
  assert.equal(fake.stored[0].codeHash, RAW_CODE_HASH);
  assert.notEqual(fake.stored[0].codeHash, code);
  assert.equal(fake.stored[0].expiresAt.getTime(), NOW.getTime() + OAUTH_TRANSFER_CODE_TTL_MS);
  assert.equal(fake.stored[0].consumedAt, null);
});

test("refuses an unknown university or a user not belonging to it", async () => {
  const fake = createService([]);

  await assert.rejects(
    fake.service.createOauthTransferCode({ universityId: UNIVERSITY_ID, userId: USER_ID }),
    OauthTransferCodeError,
  );
  assert.equal(fake.createCount, 1);
  assert.equal(fake.stored.length, 0);
});

test("refuses a user from a different university", async () => {
  const fake = createService([[OTHER_UNIVERSITY_ID, USER_ID]]);

  await assert.rejects(
    fake.service.createOauthTransferCode({ universityId: UNIVERSITY_ID, userId: USER_ID }),
    OauthTransferCodeError,
  );
  assert.equal(fake.stored.length, 0);
});

test("consumes a valid code and returns the userId", async () => {
  const fake = createService();
  await fake.service.createOauthTransferCode({ universityId: UNIVERSITY_ID, userId: USER_ID });

  const result = await fake.service.consumeOauthTransferCode({ code: RAW_CODE, universityId: UNIVERSITY_ID });

  assert.deepEqual(result, { userId: USER_ID });
  assert.equal(fake.consumeCount, 1);
});

test("refuses an expired code", async () => {
  const fake = createMemoryRepository({
    codes: [{
      universityId: UNIVERSITY_ID,
      userId: USER_ID,
      codeHash: RAW_CODE_HASH,
      expiresAt: new Date(NOW.getTime() - 1),
      consumedAt: null,
    }],
  });
  const service = createOauthTransferCodeService({
    repository: fake.repository,
    now: () => new Date(NOW),
  });

  assert.equal(
    await service.consumeOauthTransferCode({ code: RAW_CODE, universityId: UNIVERSITY_ID }),
    null,
  );
});

test("refuses replay after a code has been consumed", async () => {
  const fake = createService();
  await fake.service.createOauthTransferCode({ universityId: UNIVERSITY_ID, userId: USER_ID });

  assert.deepEqual(
    await fake.service.consumeOauthTransferCode({ code: RAW_CODE, universityId: UNIVERSITY_ID }),
    { userId: USER_ID },
  );
  assert.equal(
    await fake.service.consumeOauthTransferCode({ code: RAW_CODE, universityId: UNIVERSITY_ID }),
    null,
  );
});

test("refuses a code from a different university", async () => {
  const fake = createService([[UNIVERSITY_ID, USER_ID], [OTHER_UNIVERSITY_ID, USER_ID]]);
  await fake.service.createOauthTransferCode({ universityId: UNIVERSITY_ID, userId: USER_ID });

  assert.equal(
    await fake.service.consumeOauthTransferCode({ code: RAW_CODE, universityId: OTHER_UNIVERSITY_ID }),
    null,
  );
  assert.equal(fake.consumeCount, 1);
});

test("refuses a malformed code without querying the repository", async () => {
  const fake = createService();

  assert.equal(
    await fake.service.consumeOauthTransferCode({ code: "invalid", universityId: UNIVERSITY_ID }),
    null,
  );
  assert.equal(fake.consumeCount, 0);
});

// NOTE : le SQL réel (JOIN users↔universities, isNull(revokedAt), UPDATE conditionnel)
// n'est pas testé ici. Seul le contrat du faux dépôt est vérifié.

test("only one concurrent consumer wins", async () => {
  const fake = createService();
  await fake.service.createOauthTransferCode({ universityId: UNIVERSITY_ID, userId: USER_ID });

  const results = await Promise.all([
    fake.service.consumeOauthTransferCode({ code: RAW_CODE, universityId: UNIVERSITY_ID }),
    fake.service.consumeOauthTransferCode({ code: RAW_CODE, universityId: UNIVERSITY_ID }),
  ]);

  const successes = results.filter((r) => r !== null);
  const nulls = results.filter((r) => r === null);
  assert.equal(successes.length, 1);
  assert.equal(nulls.length, 1);
  assert.deepEqual(successes[0], { userId: USER_ID });
  assert.equal(fake.consumeCount, 2);
});

test("refuses a revoked user", async () => {
  const fake = createMemoryRepository({
    activeMemberPairs: [[UNIVERSITY_ID, USER_ID]],
    revokedUserIds: [USER_ID],
  });
  const service = createOauthTransferCodeService({
    repository: fake.repository,
    now: () => new Date(NOW),
    randomBytes: () => Buffer.from("0123456789abcdef0123456789abcdef"),
  });

  await assert.rejects(
    service.createOauthTransferCode({ universityId: UNIVERSITY_ID, userId: USER_ID }),
    OauthTransferCodeError,
  );
  assert.equal(fake.createCount, 1);
  assert.equal(fake.stored.length, 0);
});
