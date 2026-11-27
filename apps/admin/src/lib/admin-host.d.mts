export type AdminHostResolution =
  | { kind: "super" }
  | { kind: "signup" }
  | { kind: "central" }
  | { kind: "university"; slug: string }
  | null;

export function resolveAdminHost(
  host: string | null,
  adminRootDomain: string,
  slugMapJson?: string,
  authAdminCentralHost?: string,
): AdminHostResolution;

export function isAuthAdminCentralHost(
  host: string | null,
  authAdminCentralHost?: string,
): boolean;

export function buildAdminRequestUrl(options: {
  host: string | null;
  pathname: string;
  adminRootDomain: string | undefined;
  slugMapJson?: string;
  authAdminCentralHost?: string;
  secure: boolean;
  expectedKind: "central" | "university" | "super";
}): string | null;

export function isAdminProxyPathAllowed(
  kind: "super" | "signup" | "central" | "university",
  pathname: string,
): boolean;

export function getAdminSignupHostRedirect(options: {
  kind: "super" | "signup" | "university";
  pathname: string;
  search: string;
  adminRootDomain: string | undefined;
  secure: boolean;
}): string | null;

export function isAdminPasswordLoginAllowed(
  role: string | null,
  hostKind: "super" | "signup" | "university" | null,
): boolean;
