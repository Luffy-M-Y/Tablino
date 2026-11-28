import { createHmac, timingSafeEqual } from "node:crypto";
import { shouldUseSecureCookies } from "./secure-cookies";

// Étape 2FA d'un admin : mot de passe, e-mail ou Google validés, aucune session avant le code.
export const ADMIN_2FA_PENDING_TTL_MS = 300000;

type Admin2faPendingTokenData = {
  p: "admin-2fa-pending";
  u: string;
  h: string;
  x: number;
};

function getSigningSecret(secret?: string): string {
  const signingSecret = secret ?? process.env.NEXTAUTH_SECRET;
  if (typeof signingSecret !== "string" || signingSecret.length < 16) {
    throw new Error("Secret de signature absent.");
  }
  return signingSecret;
}

function normalizeHost(host: unknown): string | null {
  if (typeof host !== "string") return null;
  const value = host.trim().toLowerCase();
  return value.length > 0 ? value : null;
}

/** Jeton signé (5 min) lié à l'utilisateur et à l'hôte admin qui l'a émis. */
export function createAdmin2faPendingToken(
  userId: string,
  host: string,
  now: number = Date.now(),
  secret?: string,
): string {
  const normalizedHost = normalizeHost(host);
  if (typeof userId !== "string" || userId.length === 0 || normalizedHost === null) {
    throw new Error("Jeton 2FA impossible.");
  }
  const data: Admin2faPendingTokenData = {
    p: "admin-2fa-pending",
    u: userId,
    h: normalizedHost,
    x: now + ADMIN_2FA_PENDING_TTL_MS,
  };
  const encoded = Buffer.from(JSON.stringify(data)).toString("base64url");
  const signature = createHmac("sha256", getSigningSecret(secret)).update(encoded).digest("base64url");
  return encoded + "." + signature;
}

/** Renvoie l'identifiant de l'utilisateur, ou null (signature, but, hôte ou délai invalide). */
export function verifyAdmin2faPendingToken(
  token: unknown,
  host: unknown,
  now: number = Date.now(),
  secret?: string,
): string | null {
  const normalizedHost = normalizeHost(host);
  if (typeof token !== "string" || normalizedHost === null) return null;
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;

  const expectedSignature = createHmac("sha256", getSigningSecret(secret)).update(parts[0]).digest("base64url");
  const actualBuffer = Buffer.from(parts[1]);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (actualBuffer.length !== expectedBuffer.length) return null;
  if (!timingSafeEqual(actualBuffer, expectedBuffer)) return null;

  let data: unknown;
  try {
    data = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) return null;
  const payload = data as Partial<Admin2faPendingTokenData>;
  if (
    payload.p !== "admin-2fa-pending"
    || typeof payload.u !== "string"
    || payload.u.length === 0
    || payload.h !== normalizedHost
    || typeof payload.x !== "number"
    || payload.x < now
  ) {
    return null;
  }
  return payload.u;
}

export function getAdmin2faPendingCookieConfig() {
  const secure = shouldUseSecureCookies();
  return {
    name: (secure ? "__Secure-" : "") + "tablino-admin.2fa-pending",
    options: {
      httpOnly: true,
      sameSite: "lax" as const,
      path: "/",
      secure,
      maxAge: ADMIN_2FA_PENDING_TTL_MS / 1000,
    },
  };
}
