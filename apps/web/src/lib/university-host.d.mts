export function getUniversitySlugFromHost(
  host: string | null,
  rootDomain: string,
  slugMap?: Readonly<Record<string, string>>,
): string | null;

export function inspectUniversityHost(
  host: string | null,
  rootDomain: string,
):
  | { hostSlug: string; reason: null }
  | { hostSlug: null; reason: "invalid_host" | "invalid_root_domain" | "root_domain" };

export function parseUniversityHostSlugMap(
  value: string | undefined,
): Readonly<Record<string, string>>;

export function resolveUniversityIdFromHost(
  host: string | null,
  rootDomain: string,
  findUniversityBySlug: (slug: string) => Promise<{ id: string; status: string } | null>,
  slugMap?: Readonly<Record<string, string>>,
): Promise<string | null>;

export function isUniversityAccessAllowed(
  sessionUniversityId: string | null,
  requestedUniversityId: string | null,
  hostUniversityId: string | null,
): boolean;
