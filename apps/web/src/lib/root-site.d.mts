export const ROOT_SITE_ROUTE_HEADER: "x-tablino-root-site-route";
export const ROOT_SITE_PATH: "/vitrine";

export function isRootSiteHost(host: string | null, rootDomain: string | undefined): boolean;

export function getRootSiteTurnstileHostname(
  host: string | null,
  rootDomain: string | undefined,
): string | null;

export function getHostSlugForUniversity(
  databaseSlug: string,
  slugMap?: Readonly<Record<string, string>>,
): string | null;

export function buildUniversityStudentUrl(options: {
  slug: string;
  rootDomain: string | undefined;
  slugMap?: Readonly<Record<string, string>>;
  secure: boolean;
}): string | null;

export function buildAdminSignupUrl(options: {
  adminRootDomain: string | undefined;
  secure: boolean;
}): string | null;

export function buildUniversityAdminLoginUrl(options: {
  slug: string;
  adminRootDomain: string | undefined;
  secure: boolean;
}): string | null;
