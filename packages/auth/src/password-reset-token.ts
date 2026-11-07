import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

export const PASSWORD_RESET_TOKEN_TTL_MS = 1800000;
export const PASSWORD_RESET_CONFIRMED_TOKEN_TTL_MS = 600000;

const RESET_IV_LENGTH = 12;
const RESET_TAG_LENGTH = 16;

type ResetTokenPayload = {
  p: "password-reset";
  s: PasswordResetSurface;
  u: string;
  x: number;
};

type ConfirmedTokenPayload = {
  p: "password-reset-confirmed";
  s: PasswordResetSurface;
  u: string;
  x: number;
};

type PasswordResetSurface = "web" | "admin";

function getSigningSecret(secret?: string): string {
  const signingSecret = secret ?? process.env.NEXTAUTH_SECRET;
  if (typeof signingSecret !== "string" || signingSecret.length < 16) {
    throw new Error("Secret de signature absent.");
  }
  return signingSecret;
}

function deriveKey(secret?: string): Buffer {
  return createHash("sha256").update(getSigningSecret(secret)).digest();
}

// The request token is set from an unauthenticated email submission, so it must
// not reveal the real identifier or the existence of the account. It is
// encrypted (AES-256-GCM, random IV): the payload is opaque and same-length
// whether it carries a real identifier or the sentinel.
function encryptResetToken(payload: ResetTokenPayload, secret?: string): string {
  const key = deriveKey(secret);
  const iv = randomBytes(RESET_IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString("base64url");
}

function decryptResetToken(token: string, secret?: string): ResetTokenPayload | null {
  if (typeof token !== "string") return null;
  let blob: Buffer;
  try {
    blob = Buffer.from(token, "base64url");
  } catch {
    return null;
  }
  if (blob.length < RESET_IV_LENGTH + RESET_TAG_LENGTH + 1) return null;

  const iv = blob.subarray(0, RESET_IV_LENGTH);
  const tag = blob.subarray(RESET_IV_LENGTH, RESET_IV_LENGTH + RESET_TAG_LENGTH);
  const ciphertext = blob.subarray(RESET_IV_LENGTH + RESET_TAG_LENGTH);

  const decipher = createDecipheriv("aes-256-gcm", deriveKey(secret), iv);
  decipher.setAuthTag(tag);
  let plaintext: Buffer;
  try {
    plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    return null;
  }

  let data: unknown;
  try {
    data = JSON.parse(plaintext.toString("utf8"));
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) return null;
  const payload = data as Partial<ResetTokenPayload>;
  if (
    payload.p !== "password-reset"
    || (payload.s !== "web" && payload.s !== "admin")
    || typeof payload.u !== "string"
    || payload.u.length === 0
    || typeof payload.x !== "number"
  ) {
    return null;
  }
  return payload as ResetTokenPayload;
}

function createPasswordResetTokenForSurface(
  userId: string,
  surface: PasswordResetSurface,
  now: number,
  secret?: string,
): string {
  return encryptResetToken(
    { p: "password-reset", s: surface, u: userId, x: now + PASSWORD_RESET_TOKEN_TTL_MS },
    secret,
  );
}

function verifyPasswordResetTokenForSurface(
  token: string,
  surface: PasswordResetSurface,
  now: number,
  secret?: string,
): string | null {
  const payload = decryptResetToken(token, secret);
  if (payload === null) return null;
  if (payload.s !== surface) return null;
  if (payload.x < now) return null;
  return payload.u;
}

export function createPasswordResetToken(
  userId: string,
  now: number = Date.now(),
  secret?: string,
): string {
  return createPasswordResetTokenForSurface(userId, "web", now, secret);
}

export function createAdminPasswordResetToken(
  userId: string,
  now: number = Date.now(),
  secret?: string,
): string {
  return createPasswordResetTokenForSurface(userId, "admin", now, secret);
}

export function verifyPasswordResetToken(
  token: string,
  now: number = Date.now(),
  secret?: string,
): string | null {
  return verifyPasswordResetTokenForSurface(token, "web", now, secret);
}

export function verifyAdminPasswordResetToken(
  token: string,
  now: number = Date.now(),
  secret?: string,
): string | null {
  return verifyPasswordResetTokenForSurface(token, "admin", now, secret);
}

// The confirmed token is issued only after the user has proven email ownership
// (verified the reset code), so it is not an enumeration surface. It stays
// signed (HMAC) like the other tokens in this package.
function createPasswordResetConfirmedTokenForSurface(
  userId: string,
  surface: PasswordResetSurface,
  now: number,
  secret?: string,
): string {
  const data: ConfirmedTokenPayload = {
    p: "password-reset-confirmed",
    s: surface,
    u: userId,
    x: now + PASSWORD_RESET_CONFIRMED_TOKEN_TTL_MS,
  };
  const encoded = Buffer.from(JSON.stringify(data)).toString("base64url");
  const signature = createHmac("sha256", getSigningSecret(secret))
    .update(encoded)
    .digest("base64url");
  return encoded + "." + signature;
}

function verifyPasswordResetConfirmedTokenForSurface(
  token: string,
  surface: PasswordResetSurface,
  now: number = Date.now(),
  secret?: string,
): string | null {
  if (typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;

  const expectedSignature = createHmac("sha256", getSigningSecret(secret))
    .update(parts[0])
    .digest("base64url");
  const actualSignatureBuffer = Buffer.from(parts[1]);
  const expectedSignatureBuffer = Buffer.from(expectedSignature);
  if (actualSignatureBuffer.length !== expectedSignatureBuffer.length) return null;
  if (!timingSafeEqual(actualSignatureBuffer, expectedSignatureBuffer)) return null;

  let data: unknown;
  try {
    data = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (typeof data !== "object" || data === null || Array.isArray(data)) return null;
  const payload = data as Partial<ConfirmedTokenPayload>;
  if (
    payload.p !== "password-reset-confirmed"
    || payload.s !== surface
    || typeof payload.u !== "string"
    || payload.u.length === 0
    || typeof payload.x !== "number"
    || payload.x < now
  ) {
    return null;
  }

  return payload.u;
}

export function createPasswordResetConfirmedToken(
  userId: string,
  now: number = Date.now(),
  secret?: string,
): string {
  return createPasswordResetConfirmedTokenForSurface(userId, "web", now, secret);
}

export function createAdminPasswordResetConfirmedToken(
  userId: string,
  now: number = Date.now(),
  secret?: string,
): string {
  return createPasswordResetConfirmedTokenForSurface(userId, "admin", now, secret);
}

export function verifyPasswordResetConfirmedToken(
  token: string,
  now: number = Date.now(),
  secret?: string,
): string | null {
  return verifyPasswordResetConfirmedTokenForSurface(token, "web", now, secret);
}

export function verifyAdminPasswordResetConfirmedToken(
  token: string,
  now: number = Date.now(),
  secret?: string,
): string | null {
  return verifyPasswordResetConfirmedTokenForSurface(token, "admin", now, secret);
}

export function getPasswordResetCookieConfig(surface: PasswordResetSurface = "web") {
  const secure = process.env.NEXTAUTH_URL?.startsWith("https://") ?? false;
  return {
    name: (secure ? "__Secure-" : "") + `tablino-${surface}.password-reset`,
    options: {
      httpOnly: true,
      sameSite: "lax" as const,
      path: "/",
      secure,
      maxAge: 1800,
    },
  };
}

export function getPasswordResetConfirmedCookieConfig(
  surface: PasswordResetSurface = "web",
) {
  const secure = process.env.NEXTAUTH_URL?.startsWith("https://") ?? false;
  return {
    name: (secure ? "__Secure-" : "") + `tablino-${surface}.password-reset-confirmed`,
    options: {
      httpOnly: true,
      sameSite: "lax" as const,
      path: "/",
      secure,
      maxAge: 600,
    },
  };
}
