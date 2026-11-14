import { buildAdminReturnUrl } from "./admin-return-url.mjs";

/**
 * Resolves the super-admin approvals URL from the configured root domain.
 * @param {{ rootDomain?: string | null, secure: boolean }} options
 * @returns {string | null}
 */
export function resolveApprovalsUrl({ rootDomain, secure }) {
  const superAdminUrl = buildAdminReturnUrl({
    slug: "sup",
    adminRootDomain: rootDomain ?? "",
    secure,
  });
  if (superAdminUrl === null) return null;

  return new URL("/approvals", superAdminUrl).toString();
}
