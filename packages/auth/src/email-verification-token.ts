import { createHmac, timingSafeEqual } from "node:crypto";

export const EMAIL_VERIFICATION_TOKEN_TTL_MS = 1800000;

type EmailVerificationTokenData = {
  p: "email-verification";
  u: string;
  x: number;
};

function getSigningSecret(secret?: string): string {
  const signingSecret = secret ?? process.env.NEXTAUTH_SECRET;
  if (typeof signingSecret !== "string" || signingSecret.length < 16) {
    throw new Error("Secret de signature absent.");
  }
  return signingSecret;
}

export function createEmailVerificationToken(
  userId: string,
  now: number = Date.now(),
  secret?: string,
): string {
  const data: EmailVerificationTokenData = {
    p: "email-verification",
    u: userId,
    x: now + EMAIL_VERIFICATION_TOKEN_TTL_MS,
  };
  const encoded = Buffer.from(JSON.stringify(data)).toString("base64url");
  const signature = createHmac("sha256", getSigningSecret(secret))
    .update(encoded)
    .digest("base64url");
  return encoded + "." + signature;
}

export function verifyEmailVerificationToken(
  token: string,
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
  const payload = data as Partial<EmailVerificationTokenData>;
  if (
    payload.p !== "email-verification"
    || typeof payload.u !== "string"
    || payload.u.length === 0
    || typeof payload.x !== "number"
    || payload.x < now
  ) {
    return null;
  }

  return payload.u;
}

export function getEmailVerificationCookieConfig() {
  const secure = process.env.NEXTAUTH_URL?.startsWith("https://") ?? false;
  return {
    name: (secure ? "__Secure-" : "") + "tablino-web.email-verification",
    options: {
      httpOnly: true,
      sameSite: "lax" as const,
      path: "/",
      secure,
      maxAge: 1800,
    },
  };
}
