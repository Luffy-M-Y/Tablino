export type AdminHostResolution =
  | { kind: "super" }
  | { kind: "university"; slug: string }
  | null;

export function resolveAdminHost(
  host: string | null,
  adminRootDomain: string,
  slugMapJson?: string,
): AdminHostResolution;
