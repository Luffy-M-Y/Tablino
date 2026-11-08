export function getUniversitySlugFromHost(
  host: string | null,
  rootDomain: string,
  slugMap?: Readonly<Record<string, string>>,
): string | null;

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
