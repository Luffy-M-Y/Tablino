import { createAuthTransaction } from "./auth-transaction.mjs";
import { AUTH_CENTRAL_CALLBACK_URL } from "./auth-central-signin.mjs";
import { normalizeAuthority } from "./auth-central-host.mjs";

export const AUTH_CENTRAL_ROUTE_HEADER = "x-tablino-auth-central-route";
export const AUTH_TRANSACTION_COOKIE_NAME = "tablino-oauth-tx";
export const AUTH_TRANSACTION_MAX_AGE_SECONDS = 15 * 60;

const CSRF_PATH = "/api/auth/csrf";
const SIGNIN_PATH = "/api/auth/signin/google";
const GOOGLE_ACCOUNTS_ORIGIN = "https://accounts.google.com";
const FETCH_TIMEOUT_MS = 5000;

const GENERIC_START_ERROR = "Impossible de démarrer la connexion.";

function response(status, body = GENERIC_START_ERROR, headers = {}) {
  return new Response(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
      ...headers,
    },
  });
}

function transactionCookie(value, secure) {
  const attributes = [
    `${AUTH_TRANSACTION_COOKIE_NAME}=${value}`,
    `Max-Age=${AUTH_TRANSACTION_MAX_AGE_SECONDS}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (secure) attributes.push("Secure");
  return attributes.join("; ");
}

/**
 * Tente une redirection directe vers Google OAuth.
 * Retourne la Response 303 vers Google si elle réussit, ou null (repli).
 * Ne journalise jamais cookies, csrfToken ni URL Google.
 */
async function tryDirectGoogleRedirect({
  baseUrl,
  authCentralHost,
  txCookie,
  fetchImpl,
  fetchTimeoutMs = FETCH_TIMEOUT_MS,
}) {
  // 1. Valider que baseUrl.host === authCentralHost (normalisés).
  let baseHostNormalized;
  try {
    baseHostNormalized = normalizeAuthority(new URL(baseUrl).host);
  } catch {
    return null;
  }
  if (baseHostNormalized === null) return null;
  const centralHostNormalized = normalizeAuthority(authCentralHost);
  if (centralHostNormalized === null || baseHostNormalized !== centralHostNormalized) {
    return null;
  }

  const fetchFn = fetchImpl ?? globalThis.fetch;

  // 2. GET /api/auth/csrf
  let csrfToken;
  let csrfCookies = [];
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), fetchTimeoutMs);
    let csrfRes;
    try {
      csrfRes = await fetchFn(`${baseUrl}${CSRF_PATH}`, {
        credentials: "include",
        redirect: "manual",
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if (!csrfRes.ok) return null;

    const csrfData = await csrfRes.json();
    if (
      typeof csrfData !== "object"
      || csrfData === null
      || typeof csrfData.csrfToken !== "string"
      || csrfData.csrfToken.length === 0
    ) {
      return null;
    }
    csrfToken = csrfData.csrfToken;
    csrfCookies = csrfRes.headers.getSetCookie
      ? csrfRes.headers.getSetCookie()
      : [];
  } catch {
    return null;
  }

  // 3. POST /api/auth/signin/google
  // Cookie : paire nom=valeur de txCookie + cookies CSRF.
  const txCookiePair = txCookie.split(";")[0];
  const csrfCookiePairs = csrfCookies.map((c) => c.split(";")[0]);
  const cookieHeader = [txCookiePair, ...csrfCookiePairs].filter(Boolean).join("; ");

  let signinRes;
  let signinCookies = [];
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), fetchTimeoutMs);
    try {
      const body = new URLSearchParams();
      body.set("csrfToken", csrfToken);
      body.set("callbackUrl", AUTH_CENTRAL_CALLBACK_URL);
      signinRes = await fetchFn(`${baseUrl}${SIGNIN_PATH}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        },
        body: body.toString(),
        redirect: "manual",
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return null;
  }

  // 4. Accepter seulement 302/303 avec Location d'origine accounts.google.com.
  if (signinRes.status !== 302 && signinRes.status !== 303) return null;
  const location = signinRes.headers.get("Location");
  if (!location) return null;
  let locationUrl;
  try {
    locationUrl = new URL(location);
  } catch {
    return null;
  }
  if (locationUrl.origin !== GOOGLE_ACCOUNTS_ORIGIN) return null;

  signinCookies = signinRes.headers.getSetCookie
    ? signinRes.headers.getSetCookie()
    : [];

  // 5. Construire la réponse 303 avec tous les cookies.
  const headers = new Headers({
    "Cache-Control": "no-store",
    Location: location,
  });
  // Cookie de transaction d'abord.
  headers.append("Set-Cookie", txCookie);
  // Puis tous les cookies des deux appels NextAuth.
  for (const c of csrfCookies) headers.append("Set-Cookie", c);
  for (const c of signinCookies) headers.append("Set-Cookie", c);

  return new Response(null, { status: 303, headers });
}

export function createAuthCentralStartHandler({
  consumeOauthStartTicket,
  getSecret,
  secure,
  baseUrl,
  authCentralHost,
  now = () => new Date(),
  fetchImpl,
  fetchTimeoutMs = FETCH_TIMEOUT_MS,
}) {
  return async function handleAuthCentralStart(request) {
    if (request.headers.get(AUTH_CENTRAL_ROUTE_HEADER) !== "1") {
      return response(404);
    }

    const secret = getSecret();
    if (typeof secret !== "string" || secret.length === 0) {
      return response(500);
    }

    let form;
    try {
      form = await request.formData();
    } catch {
      return response(400);
    }

    const ticket = form.get("ticket");
    if (typeof ticket !== "string" || ticket.length === 0) {
      return response(400);
    }

    const universityId = await consumeOauthStartTicket(ticket);
    if (!universityId) return response(400);

    const transaction = createAuthTransaction({
      universityId,
      now: now(),
      secret,
    });
    const txCookie = transactionCookie(transaction, secure);

    // Piste B : tentative de redirection directe vers Google.
    if (baseUrl && authCentralHost) {
      const direct = await tryDirectGoogleRedirect({
        baseUrl,
        authCentralHost,
        txCookie,
        fetchImpl,
        fetchTimeoutMs,
      });
      if (direct) return direct;
    }

    // Repli : comportement actuel.
    return response(303, "", {
      Location: "/auth-central/signin",
      "Set-Cookie": txCookie,
    });
  };
}
