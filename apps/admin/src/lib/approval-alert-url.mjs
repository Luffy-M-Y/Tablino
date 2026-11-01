/**
 * Resolves the approvals URL from the base URL.
 * @param {string | null | undefined} baseUrl
 * @returns {string | null}
 */
export function resolveApprovalsUrl(baseUrl) {
  const trimmed = baseUrl?.trim();
  if (!trimmed) return null;
  try {
    return new URL("/approvals", trimmed).toString();
  } catch {
    return null;
  }
}
