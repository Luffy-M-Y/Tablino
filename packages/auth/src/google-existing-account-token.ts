import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto";

export const GOOGLE_EXISTING_ACCOUNT_TOKEN_TTL_MS = 10 * 60 * 1000;

const HKDF_INFO = "tablino:google-existing-account:v1";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

type Payload = {
  e: string;
  u: string;
  x: number;
};

function deriveKey(secret: string): Buffer {
  return Buffer.from(
    hkdfSync("sha256", secret, "", HKDF_INFO, 32),
  );
}

function validateSecret(secret: string | undefined): string {
  if (typeof secret !== "string" || secret.length === 0) {
    throw new Error("Secret de signature absent.");
  }
  return secret;
}

export function createGoogleExistingAccountToken({
  email,
  universityId,
  now = Date.now(),
  secret,
}: {
  email: string;
  universityId: string;
  now?: number;
  secret: string;
}): string {
  validateSecret(secret);

  const payload: Payload = {
    e: email.trim().toLowerCase(),
    u: universityId,
    x: now + GOOGLE_EXISTING_ACCOUNT_TOKEN_TTL_MS,
  };
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const iv = randomBytes(IV_LENGTH);
  const key = deriveKey(secret);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(HKDF_INFO, "utf8"));
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, encrypted, tag]).toString("base64url");
}

export function verifyGoogleExistingAccountToken(
  token: string,
  { now = Date.now(), secret }: { now?: number; secret: string | undefined },
): { email: string; universityId: string } | null {
  if (typeof secret !== "string" || secret.length === 0) return null;
  if (typeof token !== "string" || token.length === 0) return null;

  let blob: Buffer;
  try {
    blob = Buffer.from(token, "base64url");
  } catch {
    return null;
  }

  const minLength = IV_LENGTH + TAG_LENGTH + 1;
  if (blob.length < minLength) return null;

  const iv = blob.subarray(0, IV_LENGTH);
  const tagStart = blob.length - TAG_LENGTH;
  const encrypted = blob.subarray(IV_LENGTH, tagStart);
  const tag = blob.subarray(tagStart);

  let plaintext: Buffer;
  try {
    const key = deriveKey(secret);
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAAD(Buffer.from(HKDF_INFO, "utf8"));
    decipher.setAuthTag(tag);
    plaintext = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  } catch {
    return null;
  }

  let data: unknown;
  try {
    data = JSON.parse(plaintext.toString("utf8"));
  } catch {
    return null;
  }

  if (
    typeof data !== "object"
    || data === null
    || Array.isArray(data)
  ) {
    return null;
  }

  const p = data as Partial<Payload>;
  if (
    typeof p.e !== "string" || p.e.length === 0
    || typeof p.u !== "string" || p.u.length === 0
    || typeof p.x !== "number"
    || p.x <= now
  ) {
    return null;
  }

  return { email: p.e, universityId: p.u };
}

// Wrappers lisant process.env.NEXTAUTH_SECRET.
export function createGoogleExistingAccountTokenEnv(opts: {
  email: string;
  universityId: string;
  now?: number;
}): string {
  return createGoogleExistingAccountToken({
    ...opts,
    secret: process.env.NEXTAUTH_SECRET ?? "",
  });
}

export function verifyGoogleExistingAccountTokenEnv(
  token: string,
  now?: number,
): { email: string; universityId: string } | null {
  return verifyGoogleExistingAccountToken(token, {
    now,
    secret: process.env.NEXTAUTH_SECRET,
  });
}
