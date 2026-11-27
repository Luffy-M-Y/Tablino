import { createHmac, timingSafeEqual } from "node:crypto";

export const GENIUSPAY_API_BASE = "https://geniuspay.ci/api/v1/merchant";
export const GENIUSPAY_PROVIDER = "geniuspay";
/** Durée de vie du cookie qui garde la référence du paiement en cours : 30 minutes. */
export const PAYMENT_REFERENCE_TTL_SECONDS = 1800;

// Lettres, chiffres, « - » et « _ » (référence sandbox mesurée : 24 caractères avec « _ »).
// Jamais de « . » : c'est le séparateur du jeton du cookie.
const REFERENCE_PATTERN = /^[A-Za-z0-9_-]{4,64}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HOST_PATTERN = /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?::[0-9]{1,5})?$/i;

/** Référence GeniusPay acceptée (ex. « MTX-A1B2C3D4E5 »). */
export function isPaymentReference(value) {
  return typeof value === "string" && REFERENCE_PATTERN.test(value);
}

/** Page de paiement hébergée : https, hôte geniuspay.ci exact, sans identifiants ni port. */
export function isGeniusPayCheckoutUrl(value) {
  if (typeof value !== "string") return false;
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return url.protocol === "https:"
    && url.hostname === "geniuspay.ci"
    && url.port === ""
    && url.username === ""
    && url.password === "";
}

/** Demande POST du même site : en-tête Origin présent et de même hôte. */
export function isSameOriginRequest(origin, host) {
  if (typeof origin !== "string" || typeof host !== "string" || host === "") return false;
  try {
    return new URL(origin).host.toLowerCase() === host.toLowerCase();
  } catch {
    return false;
  }
}

/** Adresse de retour après paiement, sur l'hôte de l'université ; null si l'hôte est invalide. */
export function buildPaymentReturnUrl(host, secure) {
  if (typeof host !== "string" || !HOST_PATTERN.test(host)) return null;
  return (secure ? "https://" : "http://") + host.toLowerCase() + "/paiement/retour";
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Diagnostic d'un échec GeniusPay, sans secret ni donnée client : code HTTP, code d'erreur,
 * noms des champs refusés, forme de la référence et hôte de la page de paiement reçue.
 */
export function describeGeniusPayFailure(status, body) {
  const data = isRecord(body) && isRecord(body.data) ? body.data : {};
  const error = isRecord(body) && isRecord(body.error) ? body.error : {};
  const errors = isRecord(body) && isRecord(body.errors) ? body.errors
    : isRecord(error.details) ? error.details : {};
  let checkoutHost = null;
  const url = data.checkout_url ?? data.payment_url;
  if (typeof url === "string") {
    try {
      checkoutHost = new URL(url).host;
    } catch {
      checkoutHost = "invalid";
    }
  }
  return {
    status,
    errorCode: typeof error.code === "string" ? error.code.slice(0, 64) : null,
    fields: Object.keys(errors).slice(0, 10).map((key) => key.slice(0, 40)),
    referenceValid: isPaymentReference(data.reference),
    dataKeys: Object.keys(data).slice(0, 30).map((key) => key.slice(0, 40)),
    referenceType: Array.isArray(data.reference) ? "array" : data.reference === null ? "null" : typeof data.reference,
    referenceLength: typeof data.reference === "string" ? data.reference.length : null,
    referenceOtherChars: typeof data.reference === "string"
      ? [...new Set(data.reference.replace(/[A-Za-z0-9_-]/g, ""))].join("").slice(0, 10)
      : null,
    checkoutHost,
  };
}

/** Réponse de création : référence et page de paiement GeniusPay ; refus sinon. */
export function parseCheckoutResponse(body) {
  if (!isRecord(body) || body.success !== true || !isRecord(body.data)) return { ok: false };
  const { reference } = body.data;
  const checkoutUrl = body.data.checkout_url ?? body.data.payment_url;
  if (!isPaymentReference(reference) || !isGeniusPayCheckoutUrl(checkoutUrl)) return { ok: false };
  return { ok: true, reference, checkoutUrl };
}

/** Montant numérique (1000) ou texte décimal (« 1000.00 ») ; NaN sinon. */
function parseAmount(value) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && /^[0-9]{1,9}(?:\.[0-9]{1,2})?$/.test(value)) return Number(value);
  return Number.NaN;
}

/** Réponse de lecture d'un paiement, champs utiles seulement ; refus si la forme est inattendue. */
export function parsePaymentResponse(body) {
  if (!isRecord(body) || body.success !== true || !isRecord(body.data)) return { ok: false };
  const data = body.data;
  const metadata = isRecord(data.metadata) ? data.metadata : {};
  if (typeof data.reference !== "string" || typeof data.status !== "string") return { ok: false };
  return {
    ok: true,
    payment: {
      reference: data.reference,
      status: data.status,
      amount: parseAmount(data.amount),
      currency: typeof data.currency === "string" ? data.currency : null,
      environment: typeof data.environment === "string" ? data.environment : null,
      userId: typeof metadata.user_id === "string" ? metadata.user_id : null,
      universityId: typeof metadata.university_id === "string" ? metadata.university_id : null,
      plan: typeof metadata.plan === "string" ? metadata.plan : null,
    },
  };
}

const PENDING_STATUSES = new Set(["pending", "processing"]);

/**
 * Décision sur un paiement relu chez GeniusPay (seule source de vérité).
 * Validé seulement si : même référence, « completed », XOF, montant attendu,
 * même étudiant et même université, et environnement « live » si exigé.
 */
export function decidePaymentConfirmation({ payment, reference, userId, universityId, expectedAmount, requireLive }) {
  if (!isRecord(payment) || payment.reference !== reference) return { ok: false, reason: "reference_mismatch" };
  if (PENDING_STATUSES.has(payment.status)) return { ok: false, reason: "pending" };
  if (payment.status !== "completed") return { ok: false, reason: "failed" };
  if (requireLive && payment.environment !== "live") return { ok: false, reason: "environment_mismatch" };
  if (payment.currency !== null && payment.currency !== "XOF") return { ok: false, reason: "currency_mismatch" };
  if (payment.userId !== userId || payment.universityId !== universityId) return { ok: false, reason: "owner_mismatch" };
  if (payment.amount !== expectedAmount) return { ok: false, reason: "amount_mismatch" };
  return { ok: true, plan: payment.plan, amount: payment.amount };
}

/** Fenêtre d'un webhook GeniusPay : 5 minutes avant ou après l'heure du serveur. */
export const WEBHOOK_TOLERANCE_SECONDS = 300;
/** Taille maximale du corps d'un webhook : 64 Ko. */
export const WEBHOOK_MAX_BYTES = 65_536;

const SIGNATURE_PATTERN = /^[0-9a-f]{64}$/i;
const TIMESTAMP_PATTERN = /^[0-9]{1,12}$/;

/**
 * Lit un corps en flux sans dépasser maxBytes : texte UTF-8, ou null dès que la limite
 * est franchie (lecture arrêtée, même sans en-tête Content-Length).
 */
export async function readLimitedText(stream, maxBytes) {
  if (stream === null || stream === undefined) return "";
  const reader = stream.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString("utf8");
}

/** JSON à la manière de PHP json_encode (« / » et caractères non ASCII échappés). */
function phpJsonEncode(value) {
  return JSON.stringify(value)
    .replace(/\//g, "\\/")
    .replace(/[^\x00-\x7f]/g, (char) => "\\u" + char.charCodeAt(0).toString(16).padStart(4, "0"));
}

function hmacHex(data, secret) {
  return createHmac("sha256", secret).update(data).digest("hex");
}

function sameHex(expected, received) {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(received.toLowerCase(), "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Webhook GeniusPay : signature HMAC-SHA256 de « timestamp.corps » (corps reçu, puis
 * JSON recalculé à la manière de PHP), puis fenêtre de 5 minutes. Corps JSON objet exigé.
 */
export function verifyWebhookSignature({ rawBody, signature, timestamp, secret, now }) {
  if (typeof secret !== "string" || secret === "") return { ok: false, reason: "missing_secret" };
  if (typeof rawBody !== "string" || typeof signature !== "string" || typeof timestamp !== "string"
    || !SIGNATURE_PATTERN.test(signature) || !TIMESTAMP_PATTERN.test(timestamp)) {
    return { ok: false, reason: "invalid_signature" };
  }
  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    payload = undefined;
  }
  const signedRaw = sameHex(hmacHex(timestamp + "." + rawBody, secret), signature);
  const signedPhp = !signedRaw && payload !== undefined
    && sameHex(hmacHex(timestamp + "." + phpJsonEncode(payload), secret), signature);
  if (!signedRaw && !signedPhp) return { ok: false, reason: "invalid_signature" };
  const age = Math.floor(now.getTime() / 1000) - Number(timestamp);
  if (Math.abs(age) > WEBHOOK_TOLERANCE_SECONDS) return { ok: false, reason: "stale_timestamp" };
  if (!isRecord(payload)) return { ok: false, reason: "invalid_body" };
  return { ok: true, payload };
}

/** Événement d'un webhook : type et référence du paiement (null si absente ou invalide). */
export function parseWebhookEvent(payload) {
  const event = isRecord(payload) && typeof payload.event === "string" ? payload.event : null;
  const data = isRecord(payload) && isRecord(payload.data) ? payload.data : {};
  return { event, reference: isPaymentReference(data.reference) ? data.reference : null };
}

function sign(payload, secret) {
  return createHmac("sha256", secret).update("tablino-geniuspay-reference:" + payload).digest("base64url");
}

/** Jeton du cookie : référence, étudiant et expiration, signés (HMAC-SHA256). */
export function createPaymentReferenceToken({ reference, userId, now, secret }) {
  if (!isPaymentReference(reference) || !UUID_PATTERN.test(userId ?? "") || typeof secret !== "string" || secret === "") {
    return null;
  }
  const expiresAt = Math.floor(now.getTime() / 1000) + PAYMENT_REFERENCE_TTL_SECONDS;
  const payload = reference + "." + userId.toLowerCase() + "." + expiresAt;
  return payload + "." + sign(payload, secret);
}

/** Référence du jeton si la signature, l'étudiant et l'expiration sont valides ; null sinon. */
export function verifyPaymentReferenceToken(token, { userId, now, secret }) {
  if (typeof token !== "string" || typeof secret !== "string" || secret === "" || typeof userId !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [reference, tokenUserId, expiresAtText, signature] = parts;
  const payload = reference + "." + tokenUserId + "." + expiresAtText;
  const expected = Buffer.from(sign(payload, secret));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  if (!isPaymentReference(reference) || tokenUserId !== userId.toLowerCase()) return null;
  const expiresAt = Number(expiresAtText);
  if (!Number.isInteger(expiresAt) || expiresAt <= Math.floor(now.getTime() / 1000)) return null;
  return reference;
}
