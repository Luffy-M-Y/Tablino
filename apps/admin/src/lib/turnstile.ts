import "server-only";

import { verifyTurnstileToken, type TurnstileAction } from "@tablino/auth";
import { headers } from "next/headers";
import { getAdminTurnstileExpectedHostname } from "./turnstile-host.mjs";

export const TURNSTILE_ERROR_MESSAGE =
  "La vérification anti-robot a échoué. Réessayez.";

export async function verifyTurnstileForm(
  formData: FormData,
  action: TurnstileAction,
): Promise<boolean> {
  const value = formData.get("turnstileToken");
  const token = typeof value === "string" ? value : "";
  const host = (await headers()).get("host");
  const expectedHostname = getAdminTurnstileExpectedHostname(
    host,
    process.env.ADMIN_ROOT_DOMAIN,
    process.env.ADMIN_HOST_SLUG_MAP,
    process.env.AUTH_ADMIN_CENTRAL_HOST,
  );

  if (!expectedHostname) {
    console.warn(JSON.stringify({
      code: "turnstile_verification_failed",
      action,
      reason: "unvalidated_admin_host",
    }));
    return false;
  }

  const result = await verifyTurnstileToken(token, action, { expectedHostname });

  if (!result.ok) {
    console.warn(JSON.stringify({
      code: "turnstile_verification_failed",
      action,
      reason: result.reason,
    }));
  }

  return result.ok;
}
