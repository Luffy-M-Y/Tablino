import { createHmac, timingSafeEqual } from "node:crypto";

export const AUTH_ADMIN_TRANSACTION_TTL_MS = 15 * 60 * 1000;
export const AUTH_ADMIN_TRANSACTION_COOKIE_NAME = "tablino-admin-oauth-tx";
export const AUTH_ADMIN_TRANSACTION_MAX_AGE_SECONDS = 15 * 60;
export const AUTH_ADMIN_FLOWS = Object.freeze(["university", "invitation", "super_login"]);

const VERSION = "v1";
const SURFACE = "admin";
const KEY_LABEL = "tablino:oauth-transaction:admin:v1";
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const SIGNATURE_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function deriveKey(secret) {
  return createHmac("sha256", secret).update(KEY_LABEL).digest();
}

function encodePayload(payload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function isCanonicalBase64Url(value) {
  if (!BASE64URL_PATTERN.test(value)) return false;
  return Buffer.from(value, "base64url").toString("base64url") === value;
}

export function createAuthAdminTransaction(options) {
  const { flow = "university", now, secret } = options ?? {};

  if (!AUTH_ADMIN_FLOWS.includes(flow)) {
    throw new TypeError("Flux de transaction invalide.");
  }
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw new TypeError("Date de transaction invalide.");
  }
  if (typeof secret !== "string" || secret.length === 0) {
    throw new TypeError("Secret de transaction absent.");
  }

  let payload;
  if (flow === "university") {
    const universityId = options?.universityId;
    if (typeof universityId !== "string" || universityId.trim().length === 0) {
      throw new TypeError("Identifiant d'université invalide.");
    }
    payload = {
      flow,
      universityId,
      surface: SURFACE,
      expiresAt: now.getTime() + AUTH_ADMIN_TRANSACTION_TTL_MS,
    };
  } else if (flow === "invitation") {
    const invitationId = options?.invitationId;
    const transactionId = options?.transactionId;
    if (typeof invitationId !== "string" || invitationId.trim().length === 0) {
      throw new TypeError("Identifiant d'invitation invalide.");
    }
    if (typeof transactionId !== "string" || transactionId.trim().length === 0) {
      throw new TypeError("Identifiant de transaction invalide.");
    }
    payload = {
      flow,
      invitationId,
      transactionId,
      surface: SURFACE,
      expiresAt: now.getTime() + AUTH_ADMIN_TRANSACTION_TTL_MS,
    };
  } else if (flow === "super_login") {
    const transactionId = options?.transactionId;
    if (typeof transactionId !== "string" || transactionId.trim().length === 0) {
      throw new TypeError("Identifiant de transaction invalide.");
    }
    payload = {
      flow,
      transactionId,
      surface: SURFACE,
      expiresAt: now.getTime() + AUTH_ADMIN_TRANSACTION_TTL_MS,
    };
  }

  const encoded = encodePayload(payload);
  const signedValue = `${VERSION}.${encoded}`;
  const signature = createHmac("sha256", deriveKey(secret))
    .update(signedValue)
    .digest("base64url");

  return `${signedValue}.${signature}`;
}

export function parseAuthAdminTransaction(value, { now, secret } = {}) {
  if (
    typeof value !== "string"
    || value.length > 4096
    || !(now instanceof Date)
    || !Number.isFinite(now.getTime())
    || typeof secret !== "string"
    || secret.length === 0
  ) {
    return null;
  }

  const parts = value.split(".");
  if (parts.length !== 3 || parts[0] !== VERSION) return null;
  const [, encodedPayload, signature] = parts;
  if (
    !isCanonicalBase64Url(encodedPayload)
    || !SIGNATURE_PATTERN.test(signature)
    || !isCanonicalBase64Url(signature)
  ) {
    return null;
  }

  const expectedSignature = createHmac("sha256", deriveKey(secret))
    .update(`${VERSION}.${encodedPayload}`)
    .digest();
  const actualSignature = Buffer.from(signature, "base64url");
  if (
    actualSignature.length !== expectedSignature.length
    || !timingSafeEqual(actualSignature, expectedSignature)
  ) {
    return null;
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (
    payload === null
    || typeof payload !== "object"
    || Array.isArray(payload)
    || payload.surface !== SURFACE
    || !Number.isSafeInteger(payload.expiresAt)
    || payload.expiresAt <= now.getTime()
    || typeof payload.flow !== "string"
    || !AUTH_ADMIN_FLOWS.includes(payload.flow)
  ) {
    return null;
  }

  if (payload.flow === "university") {
    if (typeof payload.universityId !== "string" || payload.universityId.trim().length === 0) {
      return null;
    }
    return {
      flow: "university",
      universityId: payload.universityId,
    };
  }

  if (payload.flow === "invitation") {
    if (
      typeof payload.invitationId !== "string"
      || payload.invitationId.trim().length === 0
      || typeof payload.transactionId !== "string"
      || payload.transactionId.trim().length === 0
    ) {
      return null;
    }
    return {
      flow: "invitation",
      invitationId: payload.invitationId,
      transactionId: payload.transactionId,
    };
  }

  if (payload.flow === "super_login") {
    if (typeof payload.transactionId !== "string" || payload.transactionId.trim().length === 0) {
      return null;
    }
    return {
      flow: "super_login",
      transactionId: payload.transactionId,
    };
  }

  return null;
}

export function verifyAuthAdminTransaction(value, { now, secret, expectedFlow } = {}) {
  const parsed = parseAuthAdminTransaction(value, { now, secret });
  if (parsed === null) return null;

  if (expectedFlow !== undefined && parsed.flow !== expectedFlow) {
    return null;
  }

  if (parsed.flow === "university") {
    return parsed.universityId;
  }

  if (parsed.flow === "invitation") {
    return {
      invitationId: parsed.invitationId,
      transactionId: parsed.transactionId,
    };
  }

  if (parsed.flow === "super_login") {
    return parsed.transactionId;
  }

  return null;
}
