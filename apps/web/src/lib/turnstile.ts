import { verifyTurnstileToken, type TurnstileAction } from "@tablino/auth";
import { headers } from "next/headers";
import { getCurrentUniversityIdOrNull } from "./university";
import { getTurnstileExpectedHostname } from "./turnstile-host.mjs";
import { parseUniversityHostSlugMap } from "./university-host.mjs";

export const TURNSTILE_ERROR_MESSAGE =
  "La vérification anti-robot a échoué. Réessaie.";

export async function verifyTurnstileForm(
  formData: FormData,
  action: TurnstileAction,
): Promise<boolean> {
  const value = formData.get("turnstileToken");
  const token = typeof value === "string" ? value : "";
  const host = (await headers()).get("host");
  const universityId = await getCurrentUniversityIdOrNull();
  const expectedHostname = getTurnstileExpectedHostname(
    host,
    process.env.ROOT_DOMAIN ?? "",
    universityId,
    parseUniversityHostSlugMap(process.env.UNIVERSITY_HOST_SLUG_MAP),
  );

  if (!expectedHostname) {
    console.warn(JSON.stringify({
      code: "turnstile_verification_failed",
      action,
      reason: "unvalidated_tenant_host",
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
