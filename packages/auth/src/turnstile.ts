const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const MAX_TURNSTILE_TOKEN_LENGTH = 2048;

export const TURNSTILE_ACTIONS = [
  "login",
  "signup",
  "signup_google",
  "email_verify",
  "email_resend",
  "password_reset_request",
  "password_reset_verify",
  "password_reset_resend",
  "password_reset_set",
] as const;

export type TurnstileAction = (typeof TURNSTILE_ACTIONS)[number];

export type TurnstileFailureReason =
  | "missing_config"
  | "invalid_token"
  | "unavailable"
  | "rejected"
  | "action_mismatch"
  | "hostname_mismatch";

export type TurnstileResult =
  | { ok: true }
  | { ok: false; reason: TurnstileFailureReason };

type SiteverifyResponse = {
  success?: unknown;
  action?: unknown;
  hostname?: unknown;
};

function isSiteverifyResponse(value: unknown): value is SiteverifyResponse {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

type TurnstileOptions = {
  secret?: string;
  expectedHostname?: string;
  fetcher?: typeof fetch;
};

function getExpectedHostname(hostname?: string): string | null {
  if (hostname?.trim()) return hostname.trim().toLowerCase();
  const nextAuthUrl = process.env.NEXTAUTH_URL;
  if (!nextAuthUrl) return null;

  try {
    return new URL(nextAuthUrl).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export async function verifyTurnstileToken(
  token: string,
  expectedAction: TurnstileAction,
  options: TurnstileOptions = {},
): Promise<TurnstileResult> {
  const secret = options.secret ?? process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY;
  const expectedHostname = getExpectedHostname(options.expectedHostname);
  if (!secret?.trim() || expectedHostname === null) {
    return { ok: false, reason: "missing_config" };
  }
  if (
    typeof token !== "string"
    || token.length === 0
    || token.length > MAX_TURNSTILE_TOKEN_LENGTH
  ) {
    return { ok: false, reason: "invalid_token" };
  }

  let response: Response;
  try {
    response = await (options.fetcher ?? fetch)(SITEVERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ secret, response: token }),
      cache: "no-store",
    });
  } catch {
    return { ok: false, reason: "unavailable" };
  }
  if (!response.ok) return { ok: false, reason: "unavailable" };

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { ok: false, reason: "unavailable" };
  }
  if (!isSiteverifyResponse(payload)) {
    return { ok: false, reason: "unavailable" };
  }

  if (payload.success !== true) return { ok: false, reason: "rejected" };
  if (payload.action !== expectedAction) return { ok: false, reason: "action_mismatch" };
  if (
    typeof payload.hostname !== "string"
    || payload.hostname.toLowerCase() !== expectedHostname
  ) {
    return { ok: false, reason: "hostname_mismatch" };
  }

  return { ok: true };
}
