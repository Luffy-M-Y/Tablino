import { timingSafeEqual } from "node:crypto";

export function isAdminInvitationOutboxAuthorized(authorization, configuredSecret) {
  if (
    typeof configuredSecret !== "string"
    || Array.from(configuredSecret).length < 32
    || configuredSecret.trim().length < 32
    || typeof authorization !== "string"
    || !authorization.startsWith("Bearer ")
  ) {
    return false;
  }

  const expected = Buffer.from(configuredSecret, "utf8");
  const supplied = Buffer.from(authorization.slice("Bearer ".length), "utf8");
  return expected.length === supplied.length
    && timingSafeEqual(expected, supplied);
}

export async function runAdminInvitationOutboxRoute({
  method,
  authorization,
  configuredSecret,
  processOutbox,
}) {
  if (!isAdminInvitationOutboxAuthorized(authorization, configuredSecret)) {
    return { status: 404 };
  }
  if (method !== "POST") return { status: 404 };

  try {
    const data = await processOutbox();
    if (data !== undefined) {
      return { status: 200, body: data };
    }
    return { status: 204 };
  } catch {
    return { status: 500 };
  }
}
