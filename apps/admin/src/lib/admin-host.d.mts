export type AdminHostResolution =
  | { kind: "super" }
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
  expectedKind: "central" | "university";
}): string | null;

export function isAdminProxyPathAllowed(
  kind: "super" | "central" | "university",
  pathname: string,
): boolean;

export function isAdminPasswordLoginAllowed(
  role: "super_admin" | "university_admin",
  hostKind: "super" | "university" | null,
): boolean;
