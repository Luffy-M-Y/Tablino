import "server-only";

import { verifyTurnstileToken, type TurnstileAction } from "@tablino/auth";

export const TURNSTILE_ERROR_MESSAGE =
  "La vérification anti-robot a échoué. Réessayez.";

export async function verifyTurnstileForm(
  formData: FormData,
  action: TurnstileAction,
): Promise<boolean> {
  const value = formData.get("turnstileToken");
  const token = typeof value === "string" ? value : "";
  const result = await verifyTurnstileToken(token, action);

  if (!result.ok) {
    console.warn(JSON.stringify({
      code: "turnstile_verification_failed",
      action,
      reason: result.reason,
    }));
  }

  return result.ok;
}
