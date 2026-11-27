import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** Ticket de départ de l'inscription d'université par Google : signé, 5 minutes, sans base. */
export const UNIVERSITY_SIGNUP_START_TICKET_TTL_MS = 5 * 60 * 1000;

const VERSION = "v1";
const PURPOSE = "university-signup-start";
const KEY_LABEL = "tablino:university-signup-start:v1";
const NONCE_PATTERN = /^[A-Za-z0-9_-]{22}$/;
const PAYLOAD_PATTERN = /^[A-Za-z0-9_-]+$/;
const SIGNATURE_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function sign(value, secret) {
  return createHmac("sha256", createHmac("sha256", secret).update(KEY_LABEL).digest())
    .update(value)
    .digest();
}

function isValidSecret(secret) {
  return typeof secret === "string" && secret.length > 0;
}

function isValidDate(now) {
  return now instanceof Date && Number.isFinite(now.getTime());
}

export function createUniversitySignupStartTicket({ now, secret, createRandomBytes = randomBytes } = {}) {
  if (!isValidDate(now)) throw new TypeError("Date de ticket invalide.");
  if (!isValidSecret(secret)) throw new TypeError("Secret de ticket absent.");

  const payload = Buffer.from(JSON.stringify({
    p: PURPOSE,
    n: createRandomBytes(16).toString("base64url"),
    x: now.getTime() + UNIVERSITY_SIGNUP_START_TICKET_TTL_MS,
  }), "utf8").toString("base64url");
  const signedValue = `${VERSION}.${payload}`;
  return `${signedValue}.${sign(signedValue, secret).toString("base64url")}`;
}

/** Vrai seulement pour un ticket intact, non expiré, signé avec ce secret. */
export function verifyUniversitySignupStartTicket(ticket, { now, secret } = {}) {
  if (typeof ticket !== "string" || ticket.length > 512 || !isValidDate(now) || !isValidSecret(secret)) {
    return false;
  }

  const parts = ticket.split(".");
  if (parts.length !== 3 || parts[0] !== VERSION) return false;
  const [, payload, signature] = parts;
  if (!PAYLOAD_PATTERN.test(payload) || !SIGNATURE_PATTERN.test(signature)) return false;
  if (Buffer.from(signature, "base64url").toString("base64url") !== signature) return false;

  const expected = sign(`${VERSION}.${payload}`, secret);
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return false;

  let data;
  try {
    data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return false;
  }

  return data !== null
    && typeof data === "object"
    && !Array.isArray(data)
    && data.p === PURPOSE
    && typeof data.n === "string"
    && NONCE_PATTERN.test(data.n)
    && Number.isSafeInteger(data.x)
    && data.x > now.getTime();
}
