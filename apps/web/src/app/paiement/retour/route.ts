import { PLAN_CONFIG, recordVerifiedPayment, type Plan } from "@tablino/db";
import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { getStudentSessionUser } from "@/lib/authorization";
import { fetchGeniusPayPayment } from "@/lib/geniuspay";
import {
  decidePaymentConfirmation,
  GENIUSPAY_PROVIDER,
  verifyPaymentReferenceToken,
} from "@/lib/geniuspay-payment.mjs";
import { getPaymentCookieConfig, getPaymentCookieSecret } from "../payment-cookie";

const NO_STORE = { "Cache-Control": "no-store" } as const;
const PLAN: Plan = "premium_pro";

type Outcome = "ok" | "attente" | "echec" | "introuvable" | "erreur";

function redirectTo(location: string, clearCookie: boolean) {
  // Location relatif : même hôte que la demande (règle 35).
  const response = new NextResponse(null, { status: 303, headers: { ...NO_STORE, Location: location } });
  if (clearCookie) {
    const cookie = getPaymentCookieConfig();
    response.cookies.set(cookie.name, "", { ...cookie.options, maxAge: 0 });
  }
  return response;
}

function finish(outcome: Outcome, clearCookie: boolean) {
  return redirectTo("/choisir-acces?paiement=" + outcome, clearCookie);
}

// Retour de GeniusPay (succès ou échec) : le paiement est relu chez GeniusPay avant tout enregistrement.
export async function GET(request: NextRequest) {
  const user = await getStudentSessionUser();
  if (user === null) return redirectTo("/connexion", false);
  if (user.universityId === null) return finish("erreur", true);

  const cookie = getPaymentCookieConfig();
  const reference = verifyPaymentReferenceToken(request.cookies.get(cookie.name)?.value, {
    userId: user.id,
    now: new Date(),
    secret: getPaymentCookieSecret(),
  });
  if (reference === null) return finish("introuvable", true);

  const fetched = await fetchGeniusPayPayment(reference);
  // GeniusPay injoignable : le cookie reste, l'étudiant peut vérifier de nouveau.
  if (!fetched.ok) return finish("attente", false);

  const decision = decidePaymentConfirmation({
    payment: fetched.payment,
    reference,
    userId: user.id,
    universityId: user.universityId,
    expectedAmount: PLAN_CONFIG[PLAN].priceXof,
    requireLive: process.env.NODE_ENV === "production",
  });
  if (!decision.ok) {
    if (decision.reason === "pending") return finish("attente", false);
    if (decision.reason === "failed") return finish("echec", true);
    console.warn(JSON.stringify({ code: "payment_confirmation_refused", provider: GENIUSPAY_PROVIDER, reason: decision.reason }));
    return finish("erreur", true);
  }

  const recorded = await recordVerifiedPayment({
    universityId: user.universityId,
    userId: user.id,
    plan: decision.plan,
    provider: GENIUSPAY_PROVIDER,
    transactionId: reference,
    amountXof: decision.amount,
  });
  if (!recorded.ok) {
    console.warn(JSON.stringify({ code: "payment_record_refused", provider: GENIUSPAY_PROVIDER, reason: recorded.reason }));
    return finish("erreur", true);
  }

  revalidatePath("/", "layout");
  return finish("ok", true);
}
