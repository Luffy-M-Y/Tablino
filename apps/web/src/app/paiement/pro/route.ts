import { decideStudentAccess, PLAN_CONFIG, type Plan } from "@tablino/db";
import { NextResponse, type NextRequest } from "next/server";
import { getStudentSessionUser } from "@/lib/authorization";
import { createGeniusPayCheckout } from "@/lib/geniuspay";
import {
  buildPaymentReturnUrl,
  createPaymentReferenceToken,
  isSameOriginRequest,
} from "@/lib/geniuspay-payment.mjs";
import { getPaymentCookieConfig, getPaymentCookieSecret } from "../payment-cookie";

const NO_STORE = { "Cache-Control": "no-store" } as const;
const PLAN: Plan = "premium_pro";

function redirectTo(location: string) {
  // Location relatif : même hôte que la demande (règle 35).
  return new NextResponse(null, { status: 303, headers: { ...NO_STORE, Location: location } });
}

// Lancement du paiement Pro : formulaire POST de /choisir-acces, puis page GeniusPay.
export async function POST(request: NextRequest) {
  const host = request.headers.get("host");
  if (!isSameOriginRequest(request.headers.get("origin"), host)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: NO_STORE });
  }

  const user = await getStudentSessionUser();
  if (user === null) return redirectTo("/connexion");
  if (user.universityId === null || decideStudentAccess(user, new Date()) === "revoked") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: NO_STORE });
  }

  const cookie = getPaymentCookieConfig();
  const returnUrl = buildPaymentReturnUrl(host, cookie.options.secure);
  const secret = getPaymentCookieSecret();
  if (returnUrl === null || secret === undefined) return redirectTo("/choisir-acces?paiement=indisponible");

  const checkout = await createGeniusPayCheckout({
    amount: PLAN_CONFIG[PLAN].priceXof,
    description: "Tablino Pro (" + PLAN_CONFIG[PLAN].durationDays + " jours)",
    returnUrl,
    metadata: { user_id: user.id, university_id: user.universityId, plan: PLAN },
  });
  if (!checkout.ok) return redirectTo("/choisir-acces?paiement=indisponible");

  const token = createPaymentReferenceToken({ reference: checkout.reference, userId: user.id, now: new Date(), secret });
  if (token === null) return redirectTo("/choisir-acces?paiement=indisponible");

  const response = new NextResponse(null, {
    status: 303,
    headers: { ...NO_STORE, Location: checkout.checkoutUrl, "Referrer-Policy": "no-referrer" },
  });
  response.cookies.set(cookie.name, token, cookie.options);
  return response;
}
