import { createAuthTransaction } from "./auth-transaction.mjs";

export const AUTH_CENTRAL_ROUTE_HEADER = "x-tablino-auth-central-route";
export const AUTH_TRANSACTION_COOKIE_NAME = "tablino-oauth-tx";
export const AUTH_TRANSACTION_MAX_AGE_SECONDS = 15 * 60;

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

export function createAuthCentralStartHandler({
  consumeOauthStartTicket,
  getSecret,
  secure,
  now = () => new Date(),
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

    return response(303, "", {
      Location: "/auth-central/signin",
      "Set-Cookie": transactionCookie(transaction, secure),
    });
  };
}
