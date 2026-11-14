import {
  AUTH_ADMIN_TRANSACTION_COOKIE_NAME,
  AUTH_ADMIN_TRANSACTION_MAX_AGE_SECONDS,
  createAuthAdminTransaction,
} from "./auth-admin-transaction.mjs";
import { isAuthAdminCentralHost } from "./admin-host.mjs";

const CSRF_PATH = "/api/auth/csrf";
const SIGNIN_PATH = "/api/auth/signin/google";
const CALLBACK_URL = "/auth-admin/signin";
const GOOGLE_ACCOUNTS_ORIGIN = "https://accounts.google.com";
const FALLBACK_PATH = "/auth-admin/signin";
const FETCH_TIMEOUT_MS = 60_000;
const AUTH_ADMIN_OAUTH_SURFACE = "admin";

export const AUTH_ADMIN_START_ERROR_MESSAGE = "Impossible de démarrer la connexion.";

function textResponse(status, body = AUTH_ADMIN_START_ERROR_MESSAGE) {
  return new Response(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

function transactionCookie(value, secure) {
  const attributes = [
    `${AUTH_ADMIN_TRANSACTION_COOKIE_NAME}=${value}`,
    `Max-Age=${AUTH_ADMIN_TRANSACTION_MAX_AGE_SECONDS}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (secure) attributes.push("Secure");
  return attributes.join("; ");
}

function fallbackResponse(txCookie) {
  return new Response(null, {
    status: 303,
    headers: {
      "Cache-Control": "no-store",
      Location: FALLBACK_PATH,
      "Set-Cookie": txCookie,
    },
  });
}

async function tryDirectGoogleRedirect({
  baseUrl,
  authAdminCentralHost,
  txCookie,
  fetchImpl,
  fetchTimeoutMs,
}) {
  let origin;
  try {
    const url = new URL(baseUrl);
    if (url.pathname !== "/" || url.search || url.hash) return null;
    if (!isAuthAdminCentralHost(url.host, authAdminCentralHost)) return null;
    origin = url.origin;
  } catch {
    return null;
  }

  const fetchFn = fetchImpl ?? globalThis.fetch;
  let csrfResponse;
  let csrfCookies = [];
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), fetchTimeoutMs);
    try {
      csrfResponse = await fetchFn(`${origin}${CSRF_PATH}`, {
        credentials: "include",
        redirect: "manual",
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if (!csrfResponse.ok) return null;
    csrfCookies = csrfResponse.headers.getSetCookie?.() ?? [];
  } catch {
    return null;
  }

  let csrfData;
  try {
    csrfData = await csrfResponse.json();
  } catch {
    return null;
  }
  if (
    typeof csrfData !== "object"
    || csrfData === null
    || typeof csrfData.csrfToken !== "string"
    || csrfData.csrfToken.length === 0
  ) {
    return null;
  }

  const cookieHeader = [
    txCookie.split(";")[0],
    ...csrfCookies.map((cookie) => cookie.split(";")[0]),
  ].filter(Boolean).join("; ");

  let signinResponse;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), fetchTimeoutMs);
    try {
      signinResponse = await fetchFn(`${origin}${SIGNIN_PATH}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Cookie: cookieHeader,
        },
        body: new URLSearchParams({
          csrfToken: csrfData.csrfToken,
          callbackUrl: CALLBACK_URL,
        }).toString(),
        redirect: "manual",
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return null;
  }

  if (signinResponse.status !== 302 && signinResponse.status !== 303) return null;
  const location = signinResponse.headers.get("Location");
  if (!location) return null;

  let googleUrl;
  try {
    googleUrl = new URL(location);
  } catch {
    return null;
  }
  if (googleUrl.origin !== GOOGLE_ACCOUNTS_ORIGIN) return null;

  const responseHeaders = new Headers({
    "Cache-Control": "no-store",
    Location: location,
  });
  responseHeaders.append("Set-Cookie", txCookie);
  for (const cookie of csrfCookies) responseHeaders.append("Set-Cookie", cookie);
  for (const cookie of signinResponse.headers.getSetCookie?.() ?? []) {
    responseHeaders.append("Set-Cookie", cookie);
  }
  return new Response(null, { status: 303, headers: responseHeaders });
}

export function createAuthAdminStartHandler({
  consumeOauthStartTicket,
  getSecret,
  secure,
  baseUrl,
  authAdminCentralHost,
  now = () => new Date(),
  fetchImpl,
  fetchTimeoutMs = FETCH_TIMEOUT_MS,
}) {
  return async function handleAuthAdminStart(request) {
    if (!isAuthAdminCentralHost(request.headers.get("host"), authAdminCentralHost)) {
      return textResponse(404);
    }

    const secret = getSecret();
    if (typeof secret !== "string" || secret.length === 0) return textResponse(500);

    let form;
    try {
      form = await request.formData();
    } catch {
      return textResponse(400);
    }
    const ticket = form.get("ticket");
    if (typeof ticket !== "string" || ticket.length === 0) return textResponse(400);

    const universityId = await consumeOauthStartTicket(ticket, AUTH_ADMIN_OAUTH_SURFACE);
    if (!universityId) return textResponse(400);

    const txCookie = transactionCookie(
      createAuthAdminTransaction({ universityId, now: now(), secret }),
      secure,
    );
    const directResponse = baseUrl && authAdminCentralHost
      ? await tryDirectGoogleRedirect({
        baseUrl,
        authAdminCentralHost,
        txCookie,
        fetchImpl,
        fetchTimeoutMs,
      })
      : null;

    return directResponse ?? fallbackResponse(txCookie);
  };
}
