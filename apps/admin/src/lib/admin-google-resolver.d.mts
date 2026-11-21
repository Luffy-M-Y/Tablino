export type AdminGoogleUniversityResolverResult =
  | string
  | { invitationId: string; transactionId: string }
  | { flow: "super_login"; transactionId: string }
  | null;

export function createAdminGoogleUniversityResolver(options: {
  getHost: () => Promise<string | null>;
  getAuthAdminCentralHost: () => string | undefined;
  getCookie: () => Promise<string | undefined>;
  getSecret: () => string | undefined;
  now?: () => Date;
}): () => Promise<AdminGoogleUniversityResolverResult>;
