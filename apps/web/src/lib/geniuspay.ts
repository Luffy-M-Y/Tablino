import "server-only";

import {
  describeGeniusPayFailure,
  GENIUSPAY_API_BASE,
  parseCheckoutResponse,
  parsePaymentResponse,
  type GeniusPayPayment,
} from "@/lib/geniuspay-payment.mjs";

// Délai maximal d'un appel à GeniusPay : au-delà, refus au lieu d'une attente sans fin.
const GENIUSPAY_TIMEOUT_MS = 15_000;

/** Clés GeniusPay du serveur (jamais envoyées au navigateur). */
function readCredentials(): { apiKey: string; apiSecret: string } | null {
  const apiKey = process.env.GENIUSPAY_API_KEY?.trim() ?? "";
  const apiSecret = process.env.GENIUSPAY_API_SECRET?.trim() ?? "";
  if (!apiKey || !apiSecret) return null;
  return { apiKey, apiSecret };
}

type CallResult = { status: number; body: unknown } | { status: "missing_config" | "network_error" };

async function callGeniusPay(path: string, init: { method: "GET" | "POST"; body?: unknown }): Promise<CallResult> {
  const credentials = readCredentials();
  if (credentials === null) return { status: "missing_config" };
  try {
    const response = await fetch(GENIUSPAY_API_BASE + path, {
      method: init.method,
      headers: {
        "X-API-Key": credentials.apiKey,
        "X-API-Secret": credentials.apiSecret,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
      signal: AbortSignal.timeout(GENIUSPAY_TIMEOUT_MS),
    });
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    return { status: response.status, body };
  } catch {
    return { status: "network_error" };
  }
}

function bodyIfOk(result: CallResult): unknown {
  return typeof result.status === "number" && result.status >= 200 && result.status < 300 && "body" in result
    ? result.body
    : null;
}

/** Crée un paiement en page hébergée GeniusPay (le client y choisit son moyen de paiement). */
export async function createGeniusPayCheckout(input: {
  amount: number;
  description: string;
  returnUrl: string;
  metadata: { user_id: string; university_id: string; plan: string };
}): Promise<{ ok: true; reference: string; checkoutUrl: string } | { ok: false }> {
  const result = await callGeniusPay("/payments", {
    method: "POST",
    body: {
      amount: input.amount,
      currency: "XOF",
      description: input.description,
      success_url: input.returnUrl,
      error_url: input.returnUrl,
      metadata: input.metadata,
    },
  });
  const checkout = parseCheckoutResponse(bodyIfOk(result));
  if (!checkout.ok) {
    // Diagnostic sans secret : code HTTP, code d'erreur, champs refusés, hôte de la page reçue.
    console.warn(JSON.stringify({
      code: "payment_checkout_failed",
      provider: "geniuspay",
      ...describeGeniusPayFailure(result.status, "body" in result ? result.body : null),
    }));
  }
  return checkout;
}

/** Relit un paiement chez GeniusPay avec la clé secrète : seule source de vérité. */
export async function fetchGeniusPayPayment(
  reference: string,
): Promise<{ ok: true; payment: GeniusPayPayment } | { ok: false }> {
  const result = await callGeniusPay("/payments/" + encodeURIComponent(reference), { method: "GET" });
  const payment = parsePaymentResponse(bodyIfOk(result));
  if (!payment.ok) {
    console.warn(JSON.stringify({
      code: "payment_fetch_failed",
      provider: "geniuspay",
      ...describeGeniusPayFailure(result.status, "body" in result ? result.body : null),
    }));
  }
  return payment;
}
