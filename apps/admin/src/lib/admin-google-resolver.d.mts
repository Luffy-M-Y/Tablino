export function createAdminGoogleUniversityResolver(options: {
  getHost: () => Promise<string | null>;
  getAuthAdminCentralHost: () => string | undefined;
  getCookie: () => Promise<string | undefined>;
  getSecret: () => string | undefined;
  now?: () => Date;
}): () => Promise<string | null>;
