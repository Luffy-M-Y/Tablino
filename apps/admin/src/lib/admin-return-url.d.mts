export function buildAdminReturnUrl(options: {
  slug: string;
  adminRootDomain: string;
  secure: boolean;
}): string | null;

export function buildAdminGoogleExistingAccountUrl(options: {
  slug: string;
  adminRootDomain: string;
  secure: boolean;
  token: string;
}): string | null;

export function buildAdminTransferRedirectUrl(options: {
  slug: string;
  adminRootDomain: string;
  secure: boolean;
  code: string;
}): string | null;
