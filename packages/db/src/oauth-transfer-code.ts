import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "./client";
import * as schema from "./schema";

export const OAUTH_TRANSFER_CODE_TTL_MS = 60_000;

export type OauthTransferCodeRepository = {
  createForActiveUniversityMember: (
    universityId: string,
    userId: string,
    codeHash: string,
    expiresAt: Date,
  ) => Promise<boolean>;
  consume: (
    codeHash: string,
    universityId: string,
    now: Date,
    consumedAt: Date,
  ) => Promise<{ userId: string } | null>;
};

export type OauthTransferCodeDependencies = {
  repository: OauthTransferCodeRepository;
  now?: () => Date;
  randomBytes?: (size: number) => Buffer;
};

export class OauthTransferCodeError extends Error {
  constructor() {
    super("Université inconnue, inactive ou utilisateur non membre.");
    this.name = "OauthTransferCodeError";
  }
}

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

function isValidCode(code: string): boolean {
  if (!/^[A-Za-z0-9_-]{43}$/.test(code)) return false;
  const bytes = Buffer.from(code, "base64url");
  return bytes.length === 32 && bytes.toString("base64url") === code;
}

export function createOauthTransferCodeService({
  repository,
  now = () => new Date(),
  randomBytes: createRandomBytes = randomBytes,
}: OauthTransferCodeDependencies) {
  return {
    async createOauthTransferCode({
      universityId,
      userId,
    }: {
      universityId: string;
      userId: string;
    }): Promise<string> {
      const createdAt = now();
      const codeBytes = createRandomBytes(32);
      if (codeBytes.length !== 32) {
        throw new Error("Génération du code de transfert OAuth invalide.");
      }

      const code = codeBytes.toString("base64url");
      const created = await repository.createForActiveUniversityMember(
        universityId,
        userId,
        hashCode(code),
        new Date(createdAt.getTime() + OAUTH_TRANSFER_CODE_TTL_MS),
      );
      if (!created) throw new OauthTransferCodeError();
      return code;
    },

    async consumeOauthTransferCode({
      code,
      universityId,
    }: {
      code: string;
      universityId: string;
    }): Promise<{ userId: string } | null> {
      if (!isValidCode(code)) return null;
      const consumedAt = now();
      return repository.consume(hashCode(code), universityId, consumedAt, consumedAt);
    },
  };
}

const service = createOauthTransferCodeService({
  repository: {
    async createForActiveUniversityMember(universityId, userId, codeHash, expiresAt) {
      return db.transaction(async (transaction) => {
        const [member] = await transaction
          .select({ id: schema.users.id })
          .from(schema.users)
          .innerJoin(
            schema.universities,
            eq(schema.universities.id, schema.users.universityId),
          )
          .where(and(
            eq(schema.users.id, userId),
            eq(schema.users.universityId, universityId),
            eq(schema.universities.status, "active"),
            isNull(schema.users.revokedAt),
          ))
          .for("share")
          .limit(1);
        if (!member) return false;

        const [created] = await transaction
          .insert(schema.oauthTransferCodes)
          .values({ universityId, userId, codeHash, expiresAt })
          .returning({ id: schema.oauthTransferCodes.id });
        return Boolean(created);
      });
    },

    async consume(codeHash, universityId, now, consumedAt) {
      const [consumed] = await db
        .update(schema.oauthTransferCodes)
        .set({ consumedAt })
        .where(and(
          eq(schema.oauthTransferCodes.codeHash, codeHash),
          eq(schema.oauthTransferCodes.universityId, universityId),
          isNull(schema.oauthTransferCodes.consumedAt),
          gt(schema.oauthTransferCodes.expiresAt, now),
        ))
        .returning({ userId: schema.oauthTransferCodes.userId });
      return consumed ? { userId: consumed.userId } : null;
    },
  },
});

export const createOauthTransferCode = service.createOauthTransferCode;
export const consumeOauthTransferCode = service.consumeOauthTransferCode;
