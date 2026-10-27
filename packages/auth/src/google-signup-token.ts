import { createHmac, timingSafeEqual } from "node:crypto";

export type GoogleSignupPayload = {
  email: string;
  name: string | null;
  image: string | null;
  providerAccountId: string;
};

export const GOOGLE_SIGNUP_TOKEN_TTL_MS = 600000;

type GoogleSignupTokenData = {
  p: "google-signup";
  e: string;
  n: string | null;
  i: string | null;
  a: string;
  x: number;
};

function getSigningSecret(secret?: string): string {
  const signingSecret = secret ?? process.env.NEXTAUTH_SECRET;
  if (typeof signingSecret !== "string" || signingSecret.length < 16) {
    throw new Error("Secret de signature absent.");
  }
  return signingSecret;
}

export function createGoogleSignupToken(
  payload: GoogleSignupPayload,
  now: number = Date.now(),
  secret?: string,
): string {
  const data: GoogleSignupTokenData = {
    p: "google-signup",
    e: payload.email,
    n: payload.name,
    i: payload.image,
    a: payload.providerAccountId,
    x: now + GOOGLE_SIGNUP_TOKEN_TTL_MS,
  };
  const encoded = Buffer.from(JSON.stringify(data)).toString("base64url");
  const signature = createHmac("sha256", getSigningSecret(secret))
    .update(encoded)
    .digest("base64url");
  return encoded + "." + signature;
}

export function verifyGoogleSignupToken(
  token: string,
  now: number = Date.now(),
  secret?: string,
): GoogleSignupPayload | null {
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
  const payload = data as Partial<GoogleSignupTokenData>;
  if (
    payload.p !== "google-signup"
    || typeof payload.x !== "number"
    || payload.x < now
    || typeof payload.e !== "string"
    || payload.e.length === 0
    || typeof payload.a !== "string"
    || payload.a.length === 0
    || (payload.n !== null && typeof payload.n !== "string")
    || (payload.i !== null && typeof payload.i !== "string")
  ) {
    return null;
  }

  return {
    email: payload.e,
    name: payload.n,
    image: payload.i,
    providerAccountId: payload.a,
  };
}
