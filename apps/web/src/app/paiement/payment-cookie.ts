import "server-only";

import { getSessionCookieConfig } from "@tablino/auth";
import { PAYMENT_REFERENCE_TTL_SECONDS } from "@/lib/geniuspay-payment.mjs";

/** Cookie de la référence du paiement en cours : mêmes options que la session (httpOnly, lax, Secure en https). */
export function getPaymentCookieConfig() {
  const { options } = getSessionCookieConfig("web");
  return {
    name: (options.secure ? "__Secure-" : "") + "tablino-web.payment-reference",
    options: { ...options, maxAge: PAYMENT_REFERENCE_TTL_SECONDS },
  };
}

/** Secret de signature du cookie (NEXTAUTH_SECRET) ; undefined s'il manque. */
export function getPaymentCookieSecret(): string | undefined {
  const secret = process.env.NEXTAUTH_SECRET?.trim();
  return secret ? secret : undefined;
}
