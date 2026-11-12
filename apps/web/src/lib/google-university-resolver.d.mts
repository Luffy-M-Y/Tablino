export function createGoogleUniversityResolver(options: {
  getHost: () => Promise<string | null>;
  getAuthCentralHost: () => string | undefined;
  getCookie: () => Promise<string | undefined>;
  getSecret: () => string | undefined;
  getCurrentUniversityId: () => Promise<string>;
  now?: () => Date;
}): () => Promise<string | null>;
